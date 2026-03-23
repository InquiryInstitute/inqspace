import type { XapiDomainEvent } from './xapiEvents';

export interface IXapiEventSink {
  emit(event: XapiDomainEvent): void;
}
