import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';
import { createGitHubApp } from './githubApp';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const githubApp = createGitHubApp();
const app = createApp(githubApp);

app.listen(PORT, () => {
  console.log(`RedFlag CI listening on port ${PORT}`);
});
