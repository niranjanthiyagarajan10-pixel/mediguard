declare var pendo:
  | {
      track(
        eventName: string,
        metadata?: Record<string, string | number | boolean | undefined>,
      ): void;
    }
  | undefined;
