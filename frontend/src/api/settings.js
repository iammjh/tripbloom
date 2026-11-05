import axios from 'axios';

export async function loadSystemSettings(client = axios) {
  const response = await client.get('/api/admin/settings');
  if (response.data?.success !== true) {
    throw new Error(response.data?.message || 'Failed to load settings.');
  }
  return response.data;
}

export async function saveSystemSettings(settings, client = axios) {
  const response = await client.post('/api/admin/settings', settings);
  if (response.data?.success !== true) {
    throw new Error(response.data?.message || 'Failed to save settings.');
  }
  return response.data;
}
