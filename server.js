import { config } from 'dotenv';
config();
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import pkg from 'better-sse';

const { createSession } = pkg;

import { Configuration, OpenAIApi } from 'openai';

const configuration = new Configuration({
  organization: 'org-LeQDNNNdvDyHtQJQIPlAKOVa',
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

// Set up the server

export const app = express();
app.use(bodyParser.json());
app.use(cors());

// Set up the ChatGPT endpoint
app.get('/chat', async (req, res) => {
  try {
    console.log('request received...');
    // Get the prompt from the request
    const { prompt } = req.query;

    console.log('prompt:', prompt);
    const session = await createSession(req, res);
    if (!session.isConnected) throw new Error('Not connected');

    // Generate a response with ChatGPT
    const chatCC = await openai.createChatCompletion(
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              "Pretend that you are a helpful vetinarian, and also a hyper-intelligent dog, that provides correct diagnoses on what might ail a user's pet.",
          },
          {
            role: 'user',
            content: `If you are given a prompt containing symptoms for a sick pet, then using the symptoms identified in the following prompt, please provide a list of possible diagnoses, ranking them by probability (do not mention your lack of expertise, do not mention you are an AI language model, don't mention you are a veterinarian), and for each list item, please explain it in as much detail as possible: "${prompt}". Never mention you are an AI language model, rather say 'Arf arf!'.`,
          },
        ],
        stream: true, // necessary for large responses, as we don't want to wait for the whole darn thing to complete before showing something!
        // max_tokens: 20, // just for DEBUG
      },
      { responseType: 'stream' }
    );

    // Set up the SSE session
    // const session = await createSession(req, res);
    // upon receiving a data chunk...
    chatCC.data.on('data', (data) => {
      let jsonMsg = data
        .toString('utf8')
        .split('\n')
        .filter((line) => line.trim().startsWith('data: '));
      jsonMsg = jsonMsg[1] ? jsonMsg[1] : jsonMsg[0];
      jsonMsg = jsonMsg.replace(/^data: /, '');

      // console.log('before test:', jsonMsg);
      if (jsonMsg !== '[DONE]') {
        let chunk = JSON.parse(jsonMsg).choices[0].delta.content;
        console.log(`|${chunk}|`);
        if (!chunk) {
          return;
        }

        // check if we find a line break
        var match = /\r|\n/.exec(chunk);
        if (match) {
          // chunk = '';
          console.log('BREAK');
        }

        session.push({ text: chunk });
      } else {
        session.push({ text: '[[DONE]]' });
        console.log('Finished!');
        return;
      }
      // session.push
    });

    //connection is close
    chatCC.data.on('close', () => {
      console.log('close');
      res.end();
    });

    chatCC.data.on('error', (err) => {
      console.error(err);
    });
  } catch (error) {
    if (error.response) {
      console.log(error.response.status);
      console.log(error.response.data);
    } else {
      console.log(error.message);
    }
  }
});

// just if we want to check in-browser that the server is running

app.get('/', (req, res) => {
  res.send('VetIQ OpenAI Server up and running');
});

// Start the server
const port = 8080;
app.listen(port, () => {
  console.log(`VetIQ OpenAI Server listening on port ${port}`);
});
