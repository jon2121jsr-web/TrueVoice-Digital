import process from 'node:process';
import { restrictedDeployment } from '../../lib/previewPolicy.mjs';

export const isRestrictedPreview = () => restrictedDeployment(process.env);

export function rejectPreview(res) {
  if (!isRestrictedPreview()) return false;
  res.status(403).json({ error: 'Operation unavailable in Preview' });
  return true;
}
