import app from '../server.js';

// Disable Vercel's built-in bodyParser so omni-body gets the raw stream
export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export default app;
