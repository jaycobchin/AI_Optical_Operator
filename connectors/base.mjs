// Capabilities describe implemented operations, never a vendor's assumed features.
export class OpticalConnector {
  constructor({ id, name, status, entities = [], capabilities = {}, reason = null }) {
    this.descriptor = Object.freeze({
      id, name, status, reason,
      entities: Object.freeze([...entities]),
      capabilities: Object.freeze({ fileImport: false, incrementalImport: false, liveRead: false, writeBack: false, clinicalWrite: false, ...capabilities }),
    });
  }

  requireCapability(capability, entity) {
    const descriptor = this.descriptor;
    if (descriptor.status !== 'available') {
      throw Object.assign(Error(`${descriptor.name} is unavailable. ${descriptor.reason || ''}`.trim()), { status: 409 });
    }
    if (!Object.hasOwn(descriptor.capabilities, capability) || descriptor.capabilities[capability] !== true || (entity && !descriptor.entities.includes(entity))) {
      throw Object.assign(Error(`${descriptor.name} does not support ${capability}${entity ? ` for ${entity}` : ''}.`), { status: 400 });
    }
  }
}
