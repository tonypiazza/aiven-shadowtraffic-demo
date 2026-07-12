export async function terminateService({ token, project, service, fetchImpl = fetch, baseUrl = 'https://api.aiven.io' }) {
  const url = `${baseUrl}/v1/project/${project}/service/${service}`;
  const res = await fetchImpl(url, {
    method: 'DELETE',
    headers: { Authorization: `aivenv1 ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Aiven terminate ${service} failed: ${res.status} ${body}`);
  }
  return true;
}
