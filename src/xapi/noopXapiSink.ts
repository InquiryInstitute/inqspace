import type { IXapiEventSink } from './xapiSinkTypes';
import type { XapiDomainEvent } from './xapiEvents';

export const noopXapiSink: IXapiEventSink = {
  emit(_event: XapiDomainEvent): void {
    /* intentionally empty */
  },
};
