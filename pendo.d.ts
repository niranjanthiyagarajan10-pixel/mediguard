interface Pendo {
  trackAgent(eventType: string, metadata: object): void;
}

interface Window {
  pendo?: Pendo;
}
