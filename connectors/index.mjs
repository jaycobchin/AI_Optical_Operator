import { GenericCSVConnector } from './generic-csv/index.mjs';
import { PlatoConnector } from './plato/index.mjs';

const connectors = new Map([new GenericCSVConnector(), new PlatoConnector()].map(connector => [connector.descriptor.id, connector]));
export function listConnectors() { return [...connectors.values()].map(connector => connector.descriptor); }
export function getConnector(id = 'generic-csv') {
  const connector = connectors.get(id);
  if (!connector) throw Object.assign(Error('Unknown connector.'), { status: 400 });
  return connector;
}
