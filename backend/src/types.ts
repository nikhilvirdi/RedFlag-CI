export interface Finding {
  detectorId: string;
  severity: 'info' | 'warning' | 'high';
  file: string;
  summary: string;
  detail: string;
}
