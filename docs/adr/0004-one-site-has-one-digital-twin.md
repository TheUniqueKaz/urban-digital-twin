# Model one Digital Twin per Site

Each Site has exactly one Digital Twin, whose identity survives configuration and dataset changes. The MVP therefore uses a unique Site reference rather than twin versions or multiple active representations; this keeps Site and Digital Twin distinct while avoiding lifecycle machinery until a concrete need for parallel or historical representations appears.
