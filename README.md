# Daltn Interactive Chat

A small, provider-neutral framework for agents that ask useful questions through reusable controls. It contains validated interaction contracts, response normalization, a portable saved-reply representation and an optional React renderer. It has no model client, database, application secrets or domain-specific business logic.

This is the **0.1 foundation**, designed to work independently from the Daltn application. It has not been published to npm. The MIT license applies to this library only; it does not license the rest of the Daltn application.

## What an agent can present

Version 1 supports single choice, multiple choice, short text, long text, number, date, time and yes/no controls. An interaction contains at most three controls and six options per selection. Free text remains available through the host’s normal composer. A focused question is usually better than a questionnaire.

Controls carry context only. Existing business-specific review cards, previews, file pickers and approval systems can sit alongside them. Models cannot generate arbitrary interfaces or execute actions through this contract.

## Core quick start

```ts
import {Interaction, validateResponse, formatResponse} from '@daltn/interactive-chat';

const interaction = Interaction.parse({
  version: 1,
  question: 'What should this page help customers do?',
  description: null,
  controls: [{
    key: 'purpose', label: 'Main goal', kind: 'single_choice', required: true,
    options: [
      {value: 'book', label: 'Request a consultation'},
      {value: 'enquire', label: 'Send an enquiry'},
    ],
    min: null, max: null,
  }],
  submitLabel: 'Continue',
});

// On the server, load this interaction from the authorized canonical chat turn.
const values = validateResponse(interaction, {purpose: 'book'});
const message = formatResponse(interaction, values);
// Continue the SAME conversation through the host's normal agent executor.
// Do not treat the selection as approval to publish, send, book or change records.
```

## Persistence and adapters

`encodeInteractiveReply(answer, interaction)` creates a bounded versioned envelope that a host can save atomically with its ordinary answer. `decodeInteractiveReply(value)` validates it after readback. `interactiveText(value)` provides a readable history/export fallback. The marker is not a signature or authorization grant.

The core APIs are:

| API | Responsibility |
| --- | --- |
| `Interaction`, `Control`, `InteractionValues` | Strict bounded schemas and inferred TypeScript types |
| `validateResponse(spec, values)` | Reject unknown/stale control values and normalize canonical order |
| `formatResponse(spec, values)` | Produce a human-readable user-context message using option labels |
| `encodeInteractiveReply`, `decodeInteractiveReply` | Versioned portable representation, capped at 9,000 UTF-8 bytes |
| `interactiveText` | Fallback text for history or clients without controls |
| `createControlRegistry` | Resolve only host-installed adapters for known kind/version pairs |
| `interactionCapabilities` | Advertise limits and supported controls to an agent adapter |

The host owns authenticated access, stale-turn checks, response idempotency, loading and retry state, persistence, memory scope and tool approval. It should reject a response against a superseded turn and retain the exact original request on uncertain retries. It must not allow a choice labelled “Approve” to bypass its existing review flow.

Adapters can translate this schema into a provider’s structured output or tool result. Do not add another model call just to draw controls. The model selects a bounded specification; the client renders the registered modules. Supply only relevant business context to the agent, and retain the existing output/input budget.

## React client

The optional renderer is exported from `@daltn/interactive-chat/react`; styles are at `@daltn/interactive-chat/styles.css`. Its `onSubmit` callback passes validated response values back to the host rather than calling a business endpoint itself. React is an optional peer; core/server users do not need it.

For another client, register trusted native adapters with `createControlRegistry`. Unknown controls or future versions must show a safe text fallback instead of executing model-provided code.

## Extending the foundation

Add a control by defining its bounded data contract, server validation and accessible client adapter together. Add security and recovery tests before including it in the advertised capabilities. Ship incompatible contracts under a new explicit version. File uploads, entity search, scoped record pickers and availability widgets need host permission checks and are deliberate future extensions; they are not generic executable buttons.

## Build and release

From a standalone clone on Node.js 24:

```sh
npm ci
npm test
npm run typecheck
npm run build
npm pack --dry-run
```

The included lockfile and package CI install dependencies without requiring the Daltn monorepo. The 24 core tests cover contract validation, unknown controls and keys, typed answers, date/time correctness, response normalization, receipt limits and trusted adapters. In the Daltn monorepo, the root regression suite imports the same test file instead of keeping a second copy.

Within the Daltn monorepo, add `--workspace @daltn/interactive-chat` to the npm commands. Tests and source files live in this library; the package build requires only its declared dependencies and development dependencies.

The package compiles to ESM with declaration files. `npm pack --dry-run` inspects the release boundary: compiled library modules, declarations, renderer CSS, license and documentation. Tests, CI, application source, business data and secrets are not included in the npm artifact. Npm publication is a separate release step and is not performed by this library.

Read [SECURITY.md](./SECURITY.md) before integrating an adapter.
