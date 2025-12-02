---
title: Secure MCP servers with Access for SaaS · Cloudflare One docs
description: You can secure Model Context Protocol (MCP) servers by using
  Cloudflare Access as an OAuth Single Sign-On (SSO) provider.
lastUpdated: 2025-10-27T15:01:51.000Z
chatbotDeprioritize: false
tags: MCP
source_url:
  html: https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/saas-mcp/
  md: https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/saas-mcp/index.md
---

You can secure [Model Context Protocol (MCP) servers](https://www.cloudflare.com/learning/ai/what-is-model-context-protocol-mcp/) by using Cloudflare Access as an OAuth Single Sign-On (SSO) provider.

This guide walks through how to deploy a remote MCP server on [Cloudflare Workers](https://developers.cloudflare.com/workers/) that requires Cloudflare Access for authentication. When users connect to the MCP server using an MCP client, they will be prompted to log in to your [identity provider](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/) and are only granted access if they pass your [Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/#selectors).

## Prerequisites

* Add an [identity provider](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/) to Cloudflare Zero Trust
* Install [npm](https://docs.npmjs.com/getting-started)
* Install [Node.js](https://nodejs.org/en/)

## 1. Deploy an example MCP server

To deploy our [example MCP server](https://github.com/cloudflare/ai/tree/main/demos/remote-mcp-cf-access) on Workers:

1. Open a terminal and clone our example project:

   ```sh
   npm create cloudflare@latest -- mcp-server-cf-access --template=cloudflare/ai/demos/remote-mcp-cf-access
   ```

   When asked if you want to deploy to Cloudflare, select **No**.

2. Go to the project directory:

   ```sh
   cd mcp-server-cf-access
   ```

3. Create a [Workers KV namespace](https://developers.cloudflare.com/kv/concepts/kv-namespaces/) to store the key. The binding name should be `OAUTH_KV` if you want to run the example as written.

   ```sh
   npx wrangler kv namespace create "OAUTH_KV"
   ```

   The command will output the binding name and KV namespace ID:

   ```sh
   {
     "kv_namespaces": [
       {
         "binding": "OAUTH_KV",
         "id": "<YOUR_KV_NAMESPACE_ID>"
       }
     ]
   }
   ```

4. Open `wrangler.jsonc` in an editor and insert your `OAUTH_KV` namespace ID:

   ```jsonc
   "kv_namespaces": [
     {
       "binding": "OAUTH_KV",
       "id": "<YOUR_KV_NAMESPACE_ID>"
     }
   ],
   ```

5. You can now deploy the Worker to Cloudflare's global network:

   ```sh
   npx wrangler deploy
   ```

The Worker will be deployed to your `*.workers.dev` subdomain at `mcp-server-cf-access.<YOUR_SUBDOMAIN>.workers.dev`.

## 2. Create an Access for SaaS app

* Dashboard

  1. In [Cloudflare One](https://one.dash.cloudflare.com), go to **Access controls** > **Applications**.

  2. Select **Add an application**.

  3. Select **SaaS**.

  4. In **Application**, enter a custom name (for example, `MCP server`) and select the textbox that appears below.

  5. Select **OIDC** as the authentication protocol.

  6. Select **Add application**.

  7. In **Redirect URLs**, enter the authorization callback URL for your MCP server. The callback URL for our [example MCP server](#1-deploy-an-example-mcp-server) is `txt https://mcp-server-cf-access.<YOUR_SUBDOMAIN>.workers.dev/callback`

  8. Copy the following values to input into our example MCP server. Other MCP servers may require different sets of input values.

     * **Client secret**
     * **Client ID**
     * **Token endpoint**
     * **Authorization endpoint**
     * **Key endpoint**

  9. (Optional) Under **Advanced settings**, turn on [**Refresh tokens**](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/saas-apps/generic-oidc-saas/#advanced-settings) if you want to reduce the number of times a user needs to log in to the identity provider.

  10. Configure [Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/) to define the users who can access the MCP server.

  11. Save the application.

* API

  1. Make a `POST` request to the [Access applications](https://developers.cloudflare.com/api/resources/zero_trust/subresources/access/subresources/applications/methods/create/) endpoint:

     Required API token permissions

     At least one of the following [token permissions](https://developers.cloudflare.com/fundamentals/api/reference/permissions/) is required:

     * `Access: Apps and Policies Write`

     ```bash
     curl "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/access/apps" \
       --request POST \
       --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
       --json '{
         "name": "MCP server",
         "type": "saas",
         "saas_app": {
             "auth_type": "oidc",
             "redirect_uris": [
                 "https://mcp-server-cf-access.<YOUR_SUBDOMAIN>.workers.dev/callback"
             ],
             "grant_type": [
                 "authorization_code",
                 "refresh_tokens"
             ],
             "refresh_token_options": {
                 "lifetime": "90d"
             }
         },
         "policies": [
             "f174e90a-fafe-4643-bbbc-4a0ed4fc8415"
         ],
         "allowed_idps": []
       }'
     ```

  2. Copy the `client_id` and `client_secret` returned in the response.

  3. To determine the OAuth endpoint URLs for the SaaS application, refer to the [generic OIDC documentation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/saas-apps/generic-oidc-saas/#2-add-your-application-to-access).

## 3. Configure your MCP server

Your MCP server needs to perform an OAuth 2.0 authorization flow to get an `access_token` from the SaaS app created in [Step 1](#1-create-an-access-for-saas-app). When setting up the OAuth client on your MCP server, you will need to paste in the OAuth endpoints and credentials from the SaaS app.

To add OAuth endpoints and credentials to our [example MCP server](#1-deploy-an-example-mcp-server):

1. Create the following [Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/):

   ```sh
   wrangler secret put ACCESS_CLIENT_ID
   wrangler secret put ACCESS_CLIENT_SECRET
   wrangler secret put ACCESS_TOKEN_URL
   wrangler secret put ACCESS_AUTHORIZATION_URL
   wrangler secret put ACCESS_JWKS_URL
   ```

2. When prompted to enter a secret value, paste the corresponding values from your SaaS app:

   | Workers secret | SaaS app field |
   | - | - |
   | `ACCESS_CLIENT_ID` | Client ID |
   | `ACCESS_CLIENT_SECRET` | Client secret |
   | `ACCESS_TOKEN_URL` | Token endpoint |
   | `ACCESS_AUTHORIZATION_URL` | Authorization endpoint |
   | `ACCESS_JWKS_URL` | Key endpoint |

3. Configure a cookie encryption key:

   a. Generate a random string:

   ```sh
   openssl rand -hex 32
   ```

   b. Store the string in a Workers secret:

   ```sh
   wrangler secret put COOKIE_ENCRYPTION_KEY
   ```

## 4. Test the connection

You should now be able to connect to your MCP server using [Workers AI Playground](https://playground.ai.cloudflare.com/), [MCP inspector](https://github.com/modelcontextprotocol/inspector), or [other MCP clients](https://developers.cloudflare.com/agents/guides/remote-mcp-server/#connect-your-mcp-server-to-claude-and-other-mcp-clients) that support remote MCP servers. The demo MCP server [supports connections](https://github.com/cloudflare/ai/blob/main/demos/remote-mcp-cf-access/src/index.ts#L63-L69) via either `https://mcp-server-cf-access.<YOUR_SUBDOMAIN>.workers.dev/mcp` or `https://mcp-server-cf-access.<YOUR_SUBDOMAIN>.workers.dev/sse`.

To test in Workers AI Playground:

1. Go to [Workers AI Playground](https://playground.ai.cloudflare.com/).

2. Under **MCP Servers**, enter `https://mcp-server-cf-access.<YOUR_SUBDOMAIN>.workers.dev/mcp` for the MCP server URL.

3. Select **Connect**.

4. A popup window will appear requesting access to the MCP server. Select **Approve**.

5. Follow the prompts to log in to your identity provider.

Workers AI Playground will show a **Connected** status. The MCP server should successfully obtain an `access_token` from Cloudflare Access.
