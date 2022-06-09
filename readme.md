# `wl-faucet-nextjs-discord-cardano`

### A simple guide & easy-to-use template to deploy Next.js with Discord OAuth

## Setting up

1. Ensure you have `git`, `yarn`, `npm` & `node` installed

## Discord Credentials

1. First things first, we will need some special keys from Discord. Head to [discord.com/developers](https://discord.com/developers/applications) and hit "New Application" in the top right.
2. Secondly, open the new application and copy the "Client ID" and "Client Secret" – we will need these later so keep them safe. It is important not to share the Client Secret with anybody, too.
3. Third, during development, you will need to make a file called `.env`. In here we will securely store our sensitive information in a manner that won't be commited (meaning _pushed_ to Git for all eyes to see).
4. In this file, you need to add the Client ID and Client Secret. Optionally, you can add the APP URI and JWT Secret but these are not important for development. You will get a warning in the console, though, if you do not change these values. The reason behind that is so that you do not forget to change them in production.
   1. The file should look something like this
   ```
   CLIENT_ID=999999999999999999
   CLIENT_SECRET=yDzjb6CEC7mfhCCGQmr8fKtxw_as9CG4
   ```
   2. If you want to rid of the error messages, you can add `JWT_SECRET` (which can be anything in **development** – this does matter in production, however) & `APP_URI` (which in most occasions should be `http://localhost:3000` unless you know what you are doing).
5. You will now want to head over to the Discord developer dashboard again, select "OAuth2" in the sidebar, and add `http://localhost:3000/api/oauth` as a redirect URI.

## Production Environment variables

1. Add `CLIENT_ID`, `CLIENT_SECRET`, etc...
2. It's crucial that you add `JWT_SECRET` & `APP_URI` as these are the variables that the Discord OAuth will use to sign your jwt token and handle the Discord redirection
   i. `APP_URI` will look like `https://my-app.domain.app` (including the protocol)
   ii. `JWT_SECRET` should be a long string of cryptographically generated characters. The more the merrier. [passwordsgenerator.net](https://passwordsgenerator.net/) is a great start.
3. After this, you can deploy your app build to production! Congrats.
4. Finally, open discord developer dashboard and add another redirect URI which is your `APP_URI` with `/api/oauth` added to the end.

#### To use with Docker

1. Build
```
docker-compose build
```

2. Run
```
docker-compose up
```