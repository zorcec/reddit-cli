#!/usr/bin/env node

import { Command } from 'commander';
import { registerAuthCommand } from './commands/auth.js';
import { registerSearchCommand } from './commands/search.js';
import { registerBrowseCommand } from './commands/browse.js';
import { registerPostCommand } from './commands/post.js';
import { registerUserCommand } from './commands/user.js';
import { registerExplainCommand } from './commands/explain.js';

const program = new Command();
program
  .name('reddit')
  .description('Reddit CLI — browse, search, and analyze Reddit from your terminal')
  .version('0.1.0');

registerAuthCommand(program);
registerSearchCommand(program);
registerBrowseCommand(program);
registerPostCommand(program);
registerUserCommand(program);
registerExplainCommand(program);

program.parse();
