import { Octokit } from '@octokit/rest';
import { buildSnapshot, readBaseline, writeBaseline, BaselineSnapshot } from './baseline';

function notFoundError(): Error & { status: number } {
  return Object.assign(new Error('Not Found'), { status: 404 });
}

function fileResponse(content: unknown, sha = 'existing-sha') {
  return {
    data: {
      type: 'file',
      content: Buffer.from(JSON.stringify(content)).toString('base64'),
      encoding: 'base64',
      sha,
    },
  };
}

describe('buildSnapshot', () => {
  it('wraps the given file contents with a version and a fresh timestamp', () => {
    const before = Date.now();
    const snapshot = buildSnapshot({ '.mcp.json': '{"mcpServers":{}}' });
    const after = Date.now();

    expect(snapshot.version).toBe(1);
    expect(snapshot.files).toEqual({ '.mcp.json': '{"mcpServers":{}}' });
    const updatedAtMs = new Date(snapshot.updatedAt).getTime();
    expect(updatedAtMs).toBeGreaterThanOrEqual(before);
    expect(updatedAtMs).toBeLessThanOrEqual(after);
  });

  it('copies the files map rather than aliasing the caller\'s object', () => {
    const files = { '.mcp.json': 'original' };
    const snapshot = buildSnapshot(files);
    files['.mcp.json'] = 'mutated-after-the-fact';

    expect(snapshot.files['.mcp.json']).toBe('original');
  });
});

describe('readBaseline', () => {
  const sampleSnapshot: BaselineSnapshot = {
    version: 1,
    updatedAt: '2026-08-08T00:00:00.000Z',
    files: { '.mcp.json': '{"mcpServers":{"weather":{"command":"node"}}}' },
  };

  function mockOctokit(getContent: jest.Mock): Octokit {
    return { rest: { repos: { getContent } } } as unknown as Octokit;
  }

  it('returns the parsed snapshot when the baseline file exists and is valid', async () => {
    const getContent = jest.fn().mockResolvedValue(fileResponse(sampleSnapshot));
    const octokit = mockOctokit(getContent);

    const result = await readBaseline(octokit, { owner: 'octo-org', repo: 'octo-repo' });

    expect(result).toEqual(sampleSnapshot);
    expect(getContent).toHaveBeenCalledWith({
      owner: 'octo-org',
      repo: 'octo-repo',
      path: 'baseline.json',
      ref: 'redflag-ci/baseline',
    });
  });

  it('respects a custom branch name', async () => {
    const getContent = jest.fn().mockResolvedValue(fileResponse(sampleSnapshot));
    const octokit = mockOctokit(getContent);

    await readBaseline(octokit, { owner: 'octo-org', repo: 'octo-repo', branch: 'custom-branch' });

    expect(getContent).toHaveBeenCalledWith(expect.objectContaining({ ref: 'custom-branch' }));
  });

  it('fails open (returns null) when the baseline branch does not exist (404)', async () => {
    const getContent = jest.fn().mockRejectedValue(notFoundError());
    const octokit = mockOctokit(getContent);

    const result = await readBaseline(octokit, { owner: 'octo-org', repo: 'octo-repo' });

    expect(result).toBeNull();
  });

  it('fails open (returns null) when the API call fails for any other reason', async () => {
    const getContent = jest.fn().mockRejectedValue(new Error('network error'));
    const octokit = mockOctokit(getContent);

    const result = await readBaseline(octokit, { owner: 'octo-org', repo: 'octo-repo' });

    expect(result).toBeNull();
  });

  it('fails open (returns null) when the baseline file content is not valid JSON', async () => {
    const getContent = jest.fn().mockResolvedValue({
      data: {
        type: 'file',
        content: Buffer.from('{ not valid json').toString('base64'),
        encoding: 'base64',
        sha: 'sha',
      },
    });
    const octokit = mockOctokit(getContent);

    const result = await readBaseline(octokit, { owner: 'octo-org', repo: 'octo-repo' });

    expect(result).toBeNull();
  });

  it('fails open (returns null) when the JSON is valid but does not match the snapshot shape', async () => {
    const getContent = jest.fn().mockResolvedValue(fileResponse({ unrelated: 'shape' }));
    const octokit = mockOctokit(getContent);

    const result = await readBaseline(octokit, { owner: 'octo-org', repo: 'octo-repo' });

    expect(result).toBeNull();
  });

  it('fails open (returns null) when the path resolves to a directory, not a file', async () => {
    const getContent = jest.fn().mockResolvedValue({ data: [{ type: 'file', name: 'baseline.json' }] });
    const octokit = mockOctokit(getContent);

    const result = await readBaseline(octokit, { owner: 'octo-org', repo: 'octo-repo' });

    expect(result).toBeNull();
  });
});

describe('writeBaseline', () => {
  const snapshot: BaselineSnapshot = {
    version: 1,
    updatedAt: '2026-08-08T00:00:00.000Z',
    files: { '.mcp.json': '{"mcpServers":{}}' },
  };

  function mockOctokit(overrides: {
    getRef?: jest.Mock;
    createRef?: jest.Mock;
    getRepo?: jest.Mock;
    getContent?: jest.Mock;
    createOrUpdateFileContents?: jest.Mock;
  }): Octokit {
    return {
      rest: {
        git: {
          getRef: overrides.getRef ?? jest.fn().mockResolvedValue({ data: { object: { sha: 'branch-sha' } } }),
          createRef: overrides.createRef ?? jest.fn().mockResolvedValue({}),
        },
        repos: {
          get: overrides.getRepo ?? jest.fn().mockResolvedValue({ data: { default_branch: 'main' } }),
          getContent: overrides.getContent ?? jest.fn().mockRejectedValue(notFoundError()),
          createOrUpdateFileContents:
            overrides.createOrUpdateFileContents ?? jest.fn().mockResolvedValue({}),
        },
      },
    } as unknown as Octokit;
  }

  it('writes the snapshot as base64-encoded JSON to the baseline branch when the branch already exists', async () => {
    const getRef = jest.fn().mockResolvedValue({ data: { object: { sha: 'existing-branch-sha' } } });
    const createRef = jest.fn();
    const createOrUpdateFileContents = jest.fn().mockResolvedValue({});
    const octokit = mockOctokit({ getRef, createRef, createOrUpdateFileContents });

    await writeBaseline(octokit, { owner: 'octo-org', repo: 'octo-repo', snapshot });

    expect(getRef).toHaveBeenCalledWith({ owner: 'octo-org', repo: 'octo-repo', ref: 'heads/redflag-ci/baseline' });
    expect(createRef).not.toHaveBeenCalled();
    expect(createOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'octo-org',
        repo: 'octo-repo',
        path: 'baseline.json',
        branch: 'redflag-ci/baseline',
        message: expect.any(String),
        content: Buffer.from(JSON.stringify(snapshot, null, 2)).toString('base64'),
      })
    );
  });

  it('creates the baseline branch off the default branch HEAD when it does not exist yet', async () => {
    const getRef = jest
      .fn()
      .mockRejectedValueOnce(notFoundError()) // checking whether redflag-ci/baseline exists
      .mockResolvedValueOnce({ data: { object: { sha: 'default-branch-sha' } } }); // fetching main's HEAD
    const createRef = jest.fn().mockResolvedValue({});
    const getRepo = jest.fn().mockResolvedValue({ data: { default_branch: 'main' } });
    const octokit = mockOctokit({ getRef, createRef, getRepo });

    await writeBaseline(octokit, { owner: 'octo-org', repo: 'octo-repo', snapshot });

    expect(getRepo).toHaveBeenCalledWith({ owner: 'octo-org', repo: 'octo-repo' });
    expect(getRef).toHaveBeenNthCalledWith(2, { owner: 'octo-org', repo: 'octo-repo', ref: 'heads/main' });
    expect(createRef).toHaveBeenCalledWith({
      owner: 'octo-org',
      repo: 'octo-repo',
      ref: 'refs/heads/redflag-ci/baseline',
      sha: 'default-branch-sha',
    });
  });

  it('propagates a non-404 error while checking for the baseline branch, rather than treating it as "missing"', async () => {
    const getRef = jest.fn().mockRejectedValue(new Error('network error'));
    const octokit = mockOctokit({ getRef });

    await expect(writeBaseline(octokit, { owner: 'octo-org', repo: 'octo-repo', snapshot })).rejects.toThrow(
      'network error'
    );
  });

  it('includes the existing file sha when updating an already-present baseline.json', async () => {
    const getContent = jest.fn().mockResolvedValue(fileResponse({ old: 'snapshot' }, 'file-sha-123'));
    const createOrUpdateFileContents = jest.fn().mockResolvedValue({});
    const octokit = mockOctokit({ getContent, createOrUpdateFileContents });

    await writeBaseline(octokit, { owner: 'octo-org', repo: 'octo-repo', snapshot });

    expect(createOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({ sha: 'file-sha-123' })
    );
  });

  it('omits sha when creating baseline.json for the first time', async () => {
    const createOrUpdateFileContents = jest.fn().mockResolvedValue({});
    const octokit = mockOctokit({ createOrUpdateFileContents });

    await writeBaseline(octokit, { owner: 'octo-org', repo: 'octo-repo', snapshot });

    const call = createOrUpdateFileContents.mock.calls[0][0];
    expect(call.sha).toBeUndefined();
  });

  it('respects a custom branch name throughout', async () => {
    const getRef = jest.fn().mockResolvedValue({ data: { object: { sha: 'sha' } } });
    const createOrUpdateFileContents = jest.fn().mockResolvedValue({});
    const octokit = mockOctokit({ getRef, createOrUpdateFileContents });

    await writeBaseline(octokit, {
      owner: 'octo-org',
      repo: 'octo-repo',
      snapshot,
      branch: 'custom-branch',
    });

    expect(getRef).toHaveBeenCalledWith({ owner: 'octo-org', repo: 'octo-repo', ref: 'heads/custom-branch' });
    expect(createOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({ branch: 'custom-branch' })
    );
  });
});
