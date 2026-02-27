import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import identifyRouter from './routes/identify.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/identify', identifyRouter);

app.get('/', (req, res) => {
  res.send('Bitespeed Identity Reconciliation Service');
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
