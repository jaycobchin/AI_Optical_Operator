import { OpticalConnector } from '../base.mjs';

export class PlatoConnector extends OpticalConnector {
  constructor() {
    super({
      id: 'plato', name: 'Plato Medical', status: 'unavailable',
      reason: 'Current official API documentation, authentication scopes, commercial terms and clinic/vendor authorisation are required before implementation.',
    });
  }

  // No URL, authentication scheme, scopes or vendor capabilities are assumed.
  read() { this.requireCapability('liveRead'); }
}
