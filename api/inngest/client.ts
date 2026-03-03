import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'pixelport',
  eventKey: process.env.INNGEST_EVENT_KEY,
});
