import { Router, Request, Response } from 'express';
import { identify } from '../services/contactService';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  // placeholder; service will implement logic later
  try {
    const result = await identify(req.body);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
