import express from 'express';

const app = express();
const port = 3107;

app.get('/', (req, res) => {
  res.send('Moments Server');
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

