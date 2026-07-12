import { describe, it, expect } from 'vitest';
import { buildKafkaConnection } from '../src/config/kafkaConnection.js';

describe('buildKafkaConnection', () => {
  it('builds SSL producer config from env', () => {
    const env = {
      KAFKA_BOOTSTRAP_SERVER: 'kafka-host:12345',
      KAFKA_KEYSTORE_PATH: '/data/client.keystore.p12',
      KAFKA_KEYSTORE_PASSWORD: 'kspw',
      KAFKA_TRUSTSTORE_PATH: '/data/client.truststore.jks',
      KAFKA_TRUSTSTORE_PASSWORD: 'tspw',
    };
    const conn = buildKafkaConnection(env);
    expect(conn.kind).toBe('kafka');
    expect(conn.producerConfigs['bootstrap.servers']).toBe('kafka-host:12345');
    expect(conn.producerConfigs['security.protocol']).toBe('SSL');
    expect(conn.producerConfigs['ssl.keystore.location']).toBe('/data/client.keystore.p12');
    expect(conn.producerConfigs['ssl.keystore.type']).toBe('PKCS12');
    expect(conn.producerConfigs['ssl.truststore.location']).toBe('/data/client.truststore.jks');
    expect(conn.producerConfigs['ssl.truststore.type']).toBe('JKS');
    expect(conn.producerConfigs['key.serializer']).toMatch(/JsonSerializer/);
    expect(conn.producerConfigs['value.serializer']).toMatch(/JsonSerializer/);
  });

  it('throws when bootstrap server missing', () => {
    expect(() => buildKafkaConnection({})).toThrow(/KAFKA_BOOTSTRAP_SERVER/);
  });

  it('adds Avro value serializer + schema registry when registry env present', () => {
    const conn = buildKafkaConnection({
      KAFKA_BOOTSTRAP_SERVER: 'h:1',
      SCHEMA_REGISTRY_URL: 'https://sr-host:12345',
      SCHEMA_REGISTRY_USER: 'avnadmin',
      SCHEMA_REGISTRY_PASSWORD: 'srpw',
    });
    const pc = conn.producerConfigs;
    expect(pc['value.serializer']).toBe('io.confluent.kafka.serializers.KafkaAvroSerializer');
    expect(pc['schema.registry.url']).toBe('https://sr-host:12345');
    expect(pc['basic.auth.credentials.source']).toBe('USER_INFO');
    expect(pc['basic.auth.user.info']).toBe('avnadmin:srpw');
    // key stays a simple JSON serializer (repo_id long) — no key schema
    expect(pc['key.serializer']).toBe('io.shadowtraffic.kafka.serdes.JsonSerializer');
  });

  it('falls back to JSON value serializer when no schema registry env', () => {
    const conn = buildKafkaConnection({ KAFKA_BOOTSTRAP_SERVER: 'h:1' });
    expect(conn.producerConfigs['value.serializer']).toBe('io.shadowtraffic.kafka.serdes.JsonSerializer');
    expect(conn.producerConfigs['schema.registry.url']).toBeUndefined();
  });
});
