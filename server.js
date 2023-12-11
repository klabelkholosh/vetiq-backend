require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const pkg = require('better-sse');
const { Configuration, OpenAIApi } = require('openai');
const port = 8080;

const configuration = new Configuration({
  organization: 'org-LeQDNNNdvDyHtQJQIPlAKOVa',
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

// Set up the server
const app = express();
app.use(bodyParser.json());
app.use(cors());

// Set up the ChatGPT endpoint
app.get('/vetiqbkend/chat', async (req, res) => {
  try {
    console.log('request received...');
    // Get the prompt from the request
    const { prompt } = req.query;

    console.log('prompt:', prompt);
    // res.type('text/event-stream');
    const session = await pkg.createSession(req, res);
    if (!session.isConnected) throw new Error('Not connected');

    // Generate a response with ChatGPT
    const chatCC = await openai.createChatCompletion(
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              "You are a helpful vetinarian, and also a hyper-intelligent dog, that provides correct diagnoses on what might ail a user's pet, as well as potential remedies or steps to take to cure the dog. Please format the response in Markdown syntax: make the bullet point headings bold, and wherever you have made a heading bold, also use varied dog-appropriate emojis that illustrate the heading.",
          },
          {
            role: 'user',
            content: `Using the symptoms identified in the following prompt, please provide an unordered list of possible diagnoses, ranking them by probability (most probable at top): "${prompt}". For each diagnosis, please return it in the following format: a heading (with an appropriate emoji),followed by a paragraph explaining the diagnosis in as much detail as possible, followed by steps to remedy, formatted as an unordered list. Never mention you are an AI language model, rather say 'Arf arf!'. Do not mention your lack of expertise, do not mention you are an AI language model, don't mention you are a veterinarian.`,
          },
        ],
        stream: true, // necessary for large responses, as we don't want to wait for the whole darn thing to complete before showing something!
        // max_tokens: 1, // just for DEBUG
      },
      { responseType: 'stream' }
    );

    // Set up the SSE session
    // const session = await createSession(req, res);
    // upon receiving a data chunk...
    chatCC.data.on('data', (data) => {
      //console.log('data.toString:', data.toString('utf8').split('data: '));

      let jsonMsg = data.toString('utf8').split('data: ');

      jsonMsg.forEach((jsonM) => {
        if (jsonM.startsWith('{"id":')) {
          if (tryParseJSONObject(jsonM)) {
            let chunk = JSON.parse(jsonM).choices[0].delta.content;
            //console.log(`|${chunk}|`);
            if (!chunk) {
              return;
            }

            session.push({ text: chunk });
          } else {
            return;
          }
        } else if (jsonM.startsWith('[DONE]')) {
          session.push({ text: '[[DONE]]' });
          return;
        }
      });
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

app.get('/vetiqbkend/', (req, res) => {
  res.send('VetIQ OpenAI Server up and running');
});

// Start the server
app.listen(port, () => {
  console.log(`VetIQ OpenAI Server listening on port ${port}`);
});

/**
 * If you don't care about primitives and only objects then this function
 * is for you, otherwise look elsewhere.
 * This function will return `false` for any valid json primitive.
 * EG, 'true' -> false
 *     '123' -> false
 *     'null' -> false
 *     '"I'm a string"' -> false
 */
function tryParseJSONObject(jsonString) {
  try {
    var o = JSON.parse(jsonString);

    // Handle non-exception-throwing cases:
    // Neither JSON.parse(false) or JSON.parse(1234) throw errors, hence the type-checking,
    // but... JSON.parse(null) returns null, and typeof null === "object",
    // so we must check for that, too. Thankfully, null is falsey, so this suffices:
    if (o && typeof o === 'object') {
      return o;
    }
  } catch (e) {}

  return false;
}
