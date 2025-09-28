import type * as ts from 'typescript/lib/tsserverlibrary';

function init(modules: { typescript: typeof ts }): ts.server.PluginModule {

  function create(info: ts.server.PluginCreateInfo): ts.LanguageService {
    
    // Get the logger from the project service
    const logger = info.project.projectService.logger;

    // Log a message that we can search for.
    logger.info("POISON PILL PLUGIN: create() function has been called.");

    // This is the poison pill.
    // The moment tsserver tries to instantiate our plugin, we throw a very loud error.
    // This cannot be ignored. It will be caught and logged by tsserver.
    throw new Error("POISON PILL ACTIVATED. If you see this message in the tsserver log, then the plugin loading mechanism is working correctly.");

    // The function needs to return a LanguageService, but the code above will always throw first.
    return info.languageService;
  }

  return { create };
}

export = init;
