export function buildKafkaConnection(env) {
  const bootstrap = env.KAFKA_BOOTSTRAP_SERVER;
  if (!bootstrap) throw new Error('KAFKA_BOOTSTRAP_SERVER is required');
  return {
    kind: 'kafka',
    producerConfigs: {
      'bootstrap.servers': bootstrap,
      'security.protocol': 'SSL',
      'ssl.keystore.location': env.KAFKA_KEYSTORE_PATH || '/data/client.keystore.p12',
      'ssl.keystore.password': env.KAFKA_KEYSTORE_PASSWORD || '',
      'ssl.keystore.type': 'PKCS12',
      'ssl.key.password': env.KAFKA_KEYSTORE_PASSWORD || '',
      'ssl.truststore.location': env.KAFKA_TRUSTSTORE_PATH || '/data/client.truststore.jks',
      'ssl.truststore.password': env.KAFKA_TRUSTSTORE_PASSWORD || '',
      'ssl.truststore.type': 'JKS',
      // ShadowTraffic requires these serializers in producerConfigs (verified 1.19.7).
      'key.serializer': 'io.shadowtraffic.kafka.serdes.JsonSerializer',
      'value.serializer': 'io.shadowtraffic.kafka.serdes.JsonSerializer',
    },
  };
}
