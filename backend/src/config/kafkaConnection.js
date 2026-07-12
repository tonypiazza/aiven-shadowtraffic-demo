export function buildKafkaConnection(env) {
  const bootstrap = env.KAFKA_BOOTSTRAP_SERVER;
  if (!bootstrap) throw new Error('KAFKA_BOOTSTRAP_SERVER is required');
  const producerConfigs = {
    'bootstrap.servers': bootstrap,
    'security.protocol': 'SSL',
    'ssl.keystore.location': env.KAFKA_KEYSTORE_PATH || '/data/client.keystore.p12',
    'ssl.keystore.password': env.KAFKA_KEYSTORE_PASSWORD || '',
    'ssl.keystore.type': 'PKCS12',
    'ssl.key.password': env.KAFKA_KEYSTORE_PASSWORD || '',
    'ssl.truststore.location': env.KAFKA_TRUSTSTORE_PATH || '/data/client.truststore.jks',
    'ssl.truststore.password': env.KAFKA_TRUSTSTORE_PASSWORD || '',
    'ssl.truststore.type': 'JKS',
    // ShadowTraffic requires serializers in producerConfigs (verified 1.19.7).
    // Key stays a simple JSON/long (repo_id) — no key schema needed.
    'key.serializer': 'io.shadowtraffic.kafka.serdes.JsonSerializer',
    'value.serializer': 'io.shadowtraffic.kafka.serdes.JsonSerializer',
  };

  // When a schema registry (Aiven Karapace) is configured, emit values as Avro so
  // the Kafka Connect JDBC sink has a schema to build the Postgres table from.
  const srUrl = env.SCHEMA_REGISTRY_URL;
  if (srUrl) {
    producerConfigs['value.serializer'] = 'io.confluent.kafka.serializers.KafkaAvroSerializer';
    producerConfigs['schema.registry.url'] = srUrl;
    if (env.SCHEMA_REGISTRY_USER) {
      producerConfigs['basic.auth.credentials.source'] = 'USER_INFO';
      producerConfigs['basic.auth.user.info'] = `${env.SCHEMA_REGISTRY_USER}:${env.SCHEMA_REGISTRY_PASSWORD || ''}`;
    }
  }

  return { kind: 'kafka', producerConfigs };
}
