import { Router, Request, Response } from 'express';
import { identify } from '../services/contactService';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const { email, phoneNumber } = req.body as {
    email?: string;
    phoneNumber?: string;
  };

  // basic validation: require at least one identifier
  if (!email && !phoneNumber) {
    return res.status(400).json({ error: 'email or phoneNumber is required' });
  }

  try {
    const result = await identify({ email, phoneNumber });
    return res.json(result);
  } catch (err) {
    console.error('identify route error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
