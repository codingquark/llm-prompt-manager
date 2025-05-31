#!/usr/bin/env node

const { Command, Option } = require('commander');
const db = require('./db');
const chalk = require('chalk'); // For colored output, will install later

const program = new Command();

// Utility to ensure DB is connected before running a command and closed after
async function withDb(action) {
  try {
    await db.setupDatabase();
    await action();
  } catch (error) {
    console.error(chalk.red('CLI Error:'), error.message);
    if (error.stack && process.env.DEBUG) { // Show stack trace if DEBUG is set
      console.error(chalk.gray(error.stack));
    }
    process.exitCode = 1; // Indicate an error exit
  } finally {
    try {
      await db.closeDb();
    } catch (closeError) {
      console.error(chalk.red('Failed to close database connection:'), closeError.message);
      if (!process.exitCode) process.exitCode = 1;
    }
  }
}

program
  .name('prompt-manager')
  .description('CLI for managing LLM Prompts')
  .version('0.2.0'); // Incremented version

program
  .command('list')
  .description('List all prompts')
  .option('-c, --category <category>', 'Filter by category')
  .option('-s, --search <term>', 'Search by term in title, content, or tags')
  .action(async (options) => {
    await withDb(async () => {
      const prompts = await db.getAllPrompts(options);
      if (prompts.length === 0) {
        console.log(chalk.yellow('No prompts found.'));
        return;
      }
      
      const tableData = prompts.map(p => ({
        ID: p.id.substring(0, 8), // Shorten ID for display
        Title: p.title,
        Category: p.category || 'N/A',
        Tags: p.tags && p.tags.length > 0 ? p.tags.join(', ') : 'None'
      }));

      if (tableData.length > 0) {
        console.table(tableData);
      } else { // Should be caught by the earlier check, but as a safeguard
         console.log(chalk.yellow('No prompts to display in table.'));
      }
    });
  });

program
  .command('show <id>')
  .description('Show details of a specific prompt')
  .action(async (id) => {
    await withDb(async () => {
      const prompt = await db.getPromptById(id);
      if (prompt) {
        console.log(chalk.bold.underline(`${prompt.title}:\n`));
        console.log(`${chalk.cyan('ID:')} ${prompt.id}`);
        console.log(`${chalk.cyan('Category:')} ${prompt.category || 'N/A'}`);
        console.log(`${chalk.cyan('Tags:')} ${prompt.tags && prompt.tags.length > 0 ? prompt.tags.join(', ') : 'None'}`);
        console.log(`${chalk.cyan('Created:')} ${new Date(prompt.created_at).toLocaleString()}`);
        console.log(`${chalk.cyan('Updated:')} ${new Date(prompt.updated_at).toLocaleString()}`);
        console.log(chalk.cyan('Content:'));
        console.log(chalk.white(prompt.content));
      } else {
        console.log(chalk.yellow(`Prompt with ID "${id}" not found.`));
      }
    });
  });

program
  .command('add')
  .description('Add a new prompt')
  .requiredOption('-t, --title <title>', 'Title of the prompt')
  .requiredOption('-C, --content <content>', 'Content of the prompt') // Changed from -c to -C to avoid conflict with list
  .option('--category <category>', 'Category for the prompt')
  .option('--tags <tags>', 'Comma-separated tags for the prompt')
  .action(async (options) => {
    await withDb(async () => {
      const promptData = {
        title: options.title,
        content: options.content,
        category: options.category,
        tags: options.tags ? options.tags.split(',').map(tag => tag.trim()) : []
      };
      const newPrompt = await db.createPrompt(promptData);
      console.log(chalk.green('Prompt added successfully!'));
      console.log(`${chalk.cyan('ID:')} ${newPrompt.id}`);
      console.log(`${chalk.cyan('Title:')} ${newPrompt.title}`);
    });
  });

program
  .command('update <id>')
  .description('Update an existing prompt')
  .option('-t, --title <title>', 'New title for the prompt')
  .option('-C, --content <content>', 'New content for the prompt')
  .option('--category <category>', 'New category for the prompt')
  .option('--tags <tags>', 'New comma-separated tags for the prompt (replaces existing tags)')
  .action(async (id, options) => {
    await withDb(async () => {
      // Fetch existing prompt to only update provided fields
      const existingPrompt = await db.getPromptById(id);
      if (!existingPrompt) {
        console.log(chalk.yellow(`Prompt with ID "${id}" not found.`));
        return;
      }

      const updateData = {
        title: options.title !== undefined ? options.title : existingPrompt.title,
        content: options.content !== undefined ? options.content : existingPrompt.content,
        category: options.category !== undefined ? options.category : existingPrompt.category,
        tags: options.tags ? options.tags.split(',').map(tag => tag.trim()) : existingPrompt.tags
      };

      if (Object.keys(options).length === 0) {
         console.log(chalk.yellow('No update options provided. Use -h for help.'));
         return;
      }

      const updatedPrompt = await db.updatePrompt(id, updateData);
      if (updatedPrompt) {
        console.log(chalk.green(`Prompt "${id}" updated successfully!`));
        console.log(`${chalk.cyan('Title:')} ${updatedPrompt.title}`);
      } else {
        // This case should ideally be caught by the initial getPromptById check
        console.log(chalk.yellow(`Prompt with ID "${id}" not found or no changes made.`));
      }
    });
  });

program
  .command('delete <id>')
  .description('Delete a prompt')
  .action(async (id) => {
    await withDb(async () => {
      const success = await db.deletePrompt(id);
      if (success) {
        console.log(chalk.green(`Prompt "${id}" deleted successfully.`));
      } else {
        console.log(chalk.yellow(`Prompt with ID "${id}" not found.`));
      }
    });
  });

// TODO: Add commands for categories (list, add)
// TODO: Add commands for import/export

async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (parseError) {
    // Commander itself will print help or version, so we might not need explicit error handling here
    // unless there are specific parsing errors we want to catch differently.
    // console.error(chalk.red("Failed to parse command arguments:"), parseError.message);
    // process.exitCode = 1;
  }
}

// If called directly, run the main CLI handler.
// If required as a module, this will not run, allowing testing or programmatic use.
if (require.main === module) {
  main();
}

module.exports = program; // Export for potential testing 