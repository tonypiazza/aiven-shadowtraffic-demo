// List a service's integrations. Used to discover services wired to Kafka AFTER
// deploy (e.g. the dedicated Kafka Connect the notebook creates), which the static
// AIVEN_SERVICES list can't know about.
export async function listIntegrations({ token, project, service, fetchImpl = fetch, baseUrl = 'https://api.aiven.io' }) {
  const url = `${baseUrl}/v1/project/${project}/service/${service}/integration`;
  const res = await fetchImpl(url, {
    headers: { Authorization: `aivenv1 ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Aiven list integrations for ${service} failed: ${res.status} ${body}`);
  }
  const data = await res.json();
  return data.service_integrations || [];
}

// From Kafka's integrations, return the dedicated Kafka Connect service name(s).
// Tolerates field-name variants across API versions.
export function connectServicesFrom(integrations, kafkaService) {
  const names = new Set();
  for (const i of integrations || []) {
    const type = i.integration_type || i.integration_type_name;
    if (type !== 'kafka_connect') continue;
    const dest = i.dest_service || i.dest_service_name;
    const src = i.source_service || i.source_service_name;
    // The Connect service is the endpoint that is NOT the Kafka service itself.
    for (const n of [dest, src]) if (n && n !== kafkaService) names.add(n);
  }
  return [...names];
}

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
