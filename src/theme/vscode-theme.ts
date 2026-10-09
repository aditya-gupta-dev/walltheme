/**
 * Full VS Code theme generator: maps an M3 scheme onto every VS Code
 * color token we care about, then emits standard VS Code theme JSON.
 */
import { TOKEN_PALETTES } from './tokens';
import { argbFromHex, Contrast, Hct, hexFromArgb } from './mcu';

export interface ThemeColors {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  shadow: string;
  scrim: string;
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;
  surfaceDim: string;
  surfaceBright: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
}

export interface GenerateThemeOptions {
  colors: ThemeColors;
  isDark: boolean;
  syntaxStyle: string;
  /** Hue-rotated accent hexes for rainbow-style syntax, by degree. */
  accents?: Record<number, string>;
}

export interface WriteableTheme {
  name: string;
  type: 'dark' | 'light';
  colors: Record<string, string>;
  tokenColors: { scope: string[] | string; settings: { foreground?: string; fontStyle?: string } }[];
  semanticHighlighting: boolean;
  semanticTokenColors: Record<string, string>;
}

const editor = (c: ThemeColors): Record<string, string> => ({
  'editor.background': c.surface,
  'editor.foreground': c.onSurface,
  'editor.lineHighlightBackground': c.surfaceContainerHighest + '55',
  'editor.lineHighlightBorder': '#00000000',
  'editorLineNumber.foreground': c.outline,
  'editorLineNumber.activeForeground': c.onSurface,
  'editorCursor.foreground': c.primary,
  'editor.selectionBackground': c.primaryContainer,
  'editor.selectionForeground': c.onPrimaryContainer,
  'editor.inactiveSelectionBackground': c.primaryContainer + '88',
  'editor.selectionHighlightBackground': c.secondaryContainer + '66',
  'editor.wordHighlightBackground': c.secondaryContainer + '55',
  'editor.wordHighlightStrongBackground': c.secondaryContainer + '88',
  'editor.findMatchBackground': c.tertiaryContainer,
  'editor.findMatchHighlightBackground': c.tertiaryContainer + '88',
  'editor.findRangeHighlightBackground': c.surfaceContainerHighest + '66',
  'editor.hoverHighlightBackground': c.surfaceContainerHigh + '88',
  'editorIndentGuide.background1': c.surfaceContainerHighest,
  'editorIndentGuide.activeBackground1': c.outlineVariant,
  'editorWhitespace.foreground': c.outlineVariant + '88',
  'editorRuler.foreground': c.surfaceContainerHighest,
  'editorBracketMatch.background': c.secondaryContainer,
  'editorBracketMatch.border': c.secondary,
  'editorBracketHighlight.foreground1': c.primary,
  'editorBracketHighlight.foreground2': c.secondary,
  'editorBracketHighlight.foreground3': c.tertiary,
  'editorBracketHighlight.foreground4': c.inversePrimary,
  'editorBracketHighlight.foreground5': c.onPrimaryContainer,
  'editorBracketHighlight.foreground6': c.onTertiaryContainer,
  'editorError.foreground': c.error,
  'editorError.border': '#00000000',
  'editorWarning.foreground': c.tertiary,
  'editorWarning.border': '#00000000',
  'editorInfo.foreground': c.secondary,
  'editorInfo.border': '#00000000',
  'editorGutter.background': c.surface,
  'editorOverviewRuler.border': '#00000000',
  'editorOverviewRuler.errorForeground': c.error,
  'editorOverviewRuler.warningForeground': c.tertiary,
  'editorOverviewRuler.infoForeground': c.secondary,
  'editorOverviewRuler.addedForeground': c.secondary,
  'editorOverviewRuler.modifiedForeground': c.primary,
  'editorOverviewRuler.deletedForeground': c.error,
  'editorUnnecessaryCode.opacity': '#00000077',
});

const workbench = (c: ThemeColors, isDark: boolean): Record<string, string> => ({
  'activityBar.background': c.surfaceContainerLowest,
  'activityBar.foreground': c.onSurface,
  'activityBar.inactiveForeground': c.outline,
  'activityBar.border': c.surfaceContainerHigh,
  'activityBarBadge.background': c.primary,
  'activityBarBadge.foreground': c.onPrimary,
  'badge.background': c.primary,
  'badge.foreground': c.onPrimary,
  'banner.background': c.surfaceContainerHigh,
  'banner.foreground': c.onSurface,
  'banner.iconForeground': c.primary,
  'button.background': c.primary,
  'button.foreground': c.onPrimary,
  'button.hoverBackground': c.primary + (isDark ? 'CC' : 'DD'),
  'button.secondaryBackground': c.secondaryContainer,
  'button.secondaryForeground': c.onSecondaryContainer,
  'button.secondaryHoverBackground': c.secondaryContainer + 'CC',
  'checkbox.background': c.surfaceContainerHigh,
  'checkbox.border': c.outlineVariant,
  'checkbox.foreground': c.onSurface,
  'debugConsole.infoForeground': c.onSurfaceVariant,
  'debugConsole.warningForeground': c.tertiary,
  'debugConsole.errorForeground': c.error,
  'debugTokenExpression.name': c.primary,
  'debugTokenExpression.value': c.secondary,
  'debugTokenExpression.string': c.tertiary,
  'debugTokenExpression.boolean': c.secondary,
  'debugTokenExpression.number': c.secondary,
  'debugToolBar.background': c.surfaceContainerHigh,
  'descriptionForeground': c.onSurfaceVariant,
  'diffEditor.insertedTextBackground': c.secondaryContainer + '55',
  'diffEditor.removedTextBackground': c.errorContainer + '44',
  'diffEditor.insertedLineBackground': c.secondaryContainer + '33',
  'diffEditor.removedLineBackground': c.errorContainer + '22',
  'diffEditor.diagonalFill': c.outlineVariant + '66',
  'dropdown.background': c.surfaceContainerHigh,
  'dropdown.border': c.outlineVariant,
  'dropdown.foreground': c.onSurface,
  'editorWidget.background': c.surfaceContainerHigh,
  'editorWidget.border': c.outlineVariant,
  'editorSuggestWidget.background': c.surfaceContainerHigh,
  'editorSuggestWidget.foreground': c.onSurface,
  'editorSuggestWidget.selectedBackground': c.secondaryContainer,
  'editorSuggestWidget.selectedForeground': c.onSecondaryContainer,
  'editorSuggestWidget.focusHighlightForeground': c.primary,
  'editorHoverWidget.background': c.surfaceContainerHigh,
  'editorHoverWidget.border': c.outlineVariant,
  'editorStickyScroll.background': c.surfaceContainerLow,
  'editorStickyScrollHover.background': c.surfaceContainer,
  'errorForeground': c.error,
  'extensionButton.prominentBackground': c.primary,
  'extensionButton.prominentForeground': c.onPrimary,
  'extensionButton.prominentHoverBackground': c.primary + 'CC',
  'focusBorder': c.primary,
  'foreground': c.onSurface,
  'gitDecoration.addedResourceForeground': c.secondary,
  'gitDecoration.modifiedResourceForeground': c.primary,
  'gitDecoration.deletedResourceForeground': c.error,
  'gitDecoration.renamedResourceForeground': c.tertiary,
  'gitDecoration.stageModifiedResourceForeground': c.primary,
  'gitDecoration.conflictingResourceForeground': c.error,
  'gitDecoration.ignoredResourceForeground': c.outline,
  'gitDecoration.submoduleResourceForeground': c.onSurfaceVariant,
  'gitDecoration.untrackedResourceForeground': c.secondary,
  'input.background': c.surfaceContainerHigh,
  'input.border': c.outlineVariant,
  'input.foreground': c.onSurface,
  'input.placeholderForeground': c.outline,
  'inputOption.activeBackground': c.primaryContainer,
  'inputOption.activeBorder': c.primary,
  'inputOption.activeForeground': c.onPrimaryContainer,
  'inputValidation.errorBackground': c.errorContainer,
  'inputValidation.errorBorder': c.error,
  'inputValidation.infoBackground': c.secondaryContainer,
  'inputValidation.infoBorder': c.secondary,
  'inputValidation.warningBackground': c.tertiaryContainer,
  'inputValidation.warningBorder': c.tertiary,
  'keybindingLabel.background': c.surfaceContainerHighest,
  'keybindingLabel.foreground': c.onSurface,
  'keybindingLabel.border': c.outlineVariant,
  'list.activeSelectionBackground': c.secondaryContainer,
  'list.activeSelectionForeground': c.onSecondaryContainer,
  'list.inactiveSelectionBackground': c.surfaceContainerHighest,
  'list.inactiveSelectionForeground': c.onSurface,
  'list.hoverBackground': c.surfaceContainerHigh,
  'list.hoverForeground': c.onSurface,
  'list.focusBackground': c.secondaryContainer,
  'list.focusForeground': c.onSecondaryContainer,
  'list.highlightForeground': c.primary,
  'list.errorForeground': c.error,
  'list.warningForeground': c.tertiary,
  'listFilterWidget.background': c.surfaceContainerHighest,
  'listFilterWidget.foreground': c.onSurface,
  'listFilterWidget.noMatchesOutline': c.error,
  'menu.background': c.surfaceContainer,
  'menu.foreground': c.onSurface,
  'menu.border': c.surfaceContainerHighest + '66',
  'menu.selectionBackground': c.secondaryContainer,
  'menu.selectionForeground': c.onSecondaryContainer,
  'menu.separatorBackground': c.outlineVariant,
  'menubar.selectionBackground': c.secondaryContainer,
  'menubar.selectionForeground': c.onSecondaryContainer,
  'merge.currentHeaderBackground': c.primaryContainer + 'AA',
  'merge.currentContentBackground': c.primaryContainer + '55',
  'merge.incomingHeaderBackground': c.secondaryContainer + 'AA',
  'merge.incomingContentBackground': c.secondaryContainer + '55',
  'minimap.background': c.surface,
  'minimap.errorHighlight': c.error + 'AA',
  'minimap.warningHighlight': c.tertiary + 'AA',
  'minimap.selectionOccurrenceHighlight': c.secondaryContainer,
  'minimap.findMatchHighlight': c.tertiaryContainer + 'AA',
  'minimapGutter.addedBackground': c.secondary,
  'minimapGutter.modifiedBackground': c.primary,
  'minimapGutter.deletedBackground': c.error,
  'notifications.background': c.surfaceContainerHigh,
  'notifications.foreground': c.onSurface,
  'notifications.border': c.surfaceContainerHighest,
  'notificationCenterHeader.background': c.surfaceContainerHighest,
  'notificationLink.foreground': c.primary,
  'notificationToast.border': c.surfaceContainerHighest,
  'panel.background': c.surfaceContainerLow,
  'panel.border': c.surfaceContainerHighest,
  'panelTitle.activeForeground': c.onSurface,
  'panelTitle.inactiveForeground': c.outline,
  'panelTitle.activeBorder': c.primary,
  'panelInput.border': c.surfaceContainerHighest,
  'peekView.border': c.primary,
  'peekViewEditor.background': c.surfaceContainerLow,
  'peekViewEditorGutter.background': c.surfaceContainerLow,
  'peekViewEditor.matchHighlightBackground': c.tertiaryContainer + '88',
  'peekViewResult.background': c.surfaceContainer,
  'peekViewResult.fileForeground': c.onSurface,
  'peekViewResult.lineForeground': c.onSurfaceVariant,
  'peekViewResult.matchHighlightBackground': c.tertiaryContainer + '88',
  'peekViewResult.selectionBackground': c.secondaryContainer,
  'peekViewResult.selectionForeground': c.onSecondaryContainer,
  'peekViewTitle.background': c.surfaceContainerHigh,
  'peekViewTitleDescription.foreground': c.onSurfaceVariant,
  'peekViewTitleLabel.foreground': c.onSurface,
  'pickerGroup.border': c.outlineVariant,
  'pickerGroup.foreground': c.primary,
  'progressBar.background': c.primary,
  'quickInput.background': c.surfaceContainer,
  'quickInput.foreground': c.onSurface,
  'quickInputList.focusBackground': c.secondaryContainer,
  'quickInputList.focusForeground': c.onSecondaryContainer,
  'quickInputList.focusIconForeground': c.onSecondaryContainer,
  'sash.hoverBorder': c.primary,
  'scm.providerBorder': c.outlineVariant,
  'scrollbar.shadow': c.scrim + '44',
  'scrollbarSlider.background': c.outlineVariant + '55',
  'scrollbarSlider.hoverBackground': c.outlineVariant + '88',
  'scrollbarSlider.activeBackground': c.primary + '77',
  'searchEditor.findMatchBackground': c.tertiaryContainer + '77',
  'search.resultsInfoForeground': c.onSurfaceVariant,
  'selection.background': c.primaryContainer,
  'sideBar.background': c.surfaceContainerLow,
  'sideBar.foreground': c.onSurface,
  'sideBar.border': c.surfaceContainerHigh,
  'sideBarSectionHeader.background': c.surfaceContainerLowest,
  'sideBarSectionHeader.foreground': c.onSurface,
  'sideBarTitle.foreground': c.onSurface,
  'statusBar.background': c.surfaceContainerLowest,
  'statusBar.foreground': c.onSurfaceVariant,
  'statusBar.border': c.surfaceContainerHigh,
  'statusBar.noFolderBackground': c.surfaceContainerLowest,
  'statusBar.noFolderForeground': c.onSurfaceVariant,
  'statusBar.debuggingBackground': c.tertiaryContainer,
  'statusBar.debuggingForeground': c.onTertiaryContainer,
  'statusBarItem.activeBackground': c.surfaceContainerHighest,
  'statusBarItem.hoverBackground': c.surfaceContainerHigh,
  'statusBarItem.prominentBackground': c.primary,
  'statusBarItem.prominentForeground': c.onPrimary,
  'statusBarItem.prominentHoverBackground': c.primary + 'CC',
  'statusBarItem.remoteBackground': c.primaryContainer,
  'statusBarItem.remoteForeground': c.onPrimaryContainer,
  'statusBarItem.errorBackground': c.errorContainer,
  'statusBarItem.errorForeground': c.onErrorContainer,
  'statusBarItem.warningBackground': c.tertiaryContainer,
  'statusBarItem.warningForeground': c.onTertiaryContainer,
  'symbolIcon.arrayForeground': c.secondary,
  'symbolIcon.booleanForeground': c.secondary,
  'symbolIcon.classForeground': c.tertiary,
  'symbolIcon.colorForeground': c.tertiary,
  'symbolIcon.constantForeground': c.secondary,
  'symbolIcon.constructorForeground': c.primary,
  'symbolIcon.enumeratorForeground': c.tertiary,
  'symbolIcon.eventForeground': c.primary,
  'symbolIcon.fieldForeground': c.secondary,
  'symbolIcon.fileForeground': c.onSurfaceVariant,
  'symbolIcon.folderForeground': c.onSurfaceVariant,
  'symbolIcon.functionForeground': c.primary,
  'symbolIcon.interfaceForeground': c.tertiary,
  'symbolIcon.keyForeground': c.secondary,
  'symbolIcon.keywordForeground': c.primary,
  'symbolIcon.methodForeground': c.primary,
  'symbolIcon.moduleForeground': c.onSurfaceVariant,
  'symbolIcon.namespaceForeground': c.onSurfaceVariant,
  'symbolIcon.nullForeground': c.secondary,
  'symbolIcon.numberForeground': c.secondary,
  'symbolIcon.objectForeground': c.secondary,
  'symbolIcon.operatorForeground': c.onSurfaceVariant,
  'symbolIcon.packageForeground': c.onSurfaceVariant,
  'symbolIcon.propertyForeground': c.secondary,
  'symbolIcon.referenceForeground': c.onSurfaceVariant,
  'symbolIcon.snippetForeground': c.onSurfaceVariant,
  'symbolIcon.stringForeground': c.tertiary,
  'symbolIcon.structForeground': c.tertiary,
  'symbolIcon.textForeground': c.onSurface,
  'symbolIcon.typeParameterForeground': c.tertiary,
  'symbolIcon.unitForeground': c.secondary,
  'symbolIcon.variableForeground': c.secondary,
  'tab.activeBackground': c.surface,
  'tab.activeForeground': c.onSurface,
  'tab.activeBorderTop': c.primary,
  'tab.activeBorder': '#00000000',
  'tab.inactiveBackground': c.surfaceContainerLow,
  'tab.inactiveForeground': c.outline,
  'tab.hoverBackground': c.surfaceContainer,
  'tab.hoverForeground': c.onSurface,
  'tab.border': c.surfaceContainerHighest + '66',
  'tab.unfocusedActiveBackground': c.surface,
  'tab.unfocusedActiveForeground': c.onSurface,
  'tab.unfocusedHoverBackground': c.surfaceContainer,
  'tab.unfocusedInactiveBackground': c.surfaceContainerLow,
  'terminal.background': c.surface,
  'terminal.border': c.surfaceContainerHighest,
  'terminal.foreground': c.onSurface,
  'terminal.ansiBlack': c.surfaceContainerHighest,
  'terminal.ansiRed': c.error,
  'terminal.ansiGreen': c.secondary,
  'terminal.ansiYellow': c.tertiary,
  'terminal.ansiBlue': c.primary,
  'terminal.ansiMagenta': c.inversePrimary,
  'terminal.ansiCyan': c.onPrimaryContainer,
  'terminal.ansiWhite': c.onSurface,
  'terminal.ansiBrightBlack': c.outline,
  'terminal.ansiBrightRed': c.onErrorContainer,
  'terminal.ansiBrightGreen': c.onSecondaryContainer,
  'terminal.ansiBrightYellow': c.onTertiaryContainer,
  'terminal.ansiBrightBlue': c.primaryContainer,
  'terminal.ansiBrightMagenta': c.tertiaryContainer,
  'terminal.ansiBrightCyan': c.secondaryContainer,
  'terminal.ansiBrightWhite': c.surfaceBright,
  'terminal.dropBackground': c.primaryContainer + '88',
  'terminalCommandDecoration.successBackground': c.secondary,
  'terminalCommandDecoration.errorBackground': c.error,
  'testing.iconFailed': c.error,
  'testing.iconPassed': c.secondary,
  'testing.runAction': c.primary,
  'textBlockQuote.background': c.surfaceContainerHigh,
  'textBlockQuote.border': c.primary,
  'textCodeBlock.background': c.surfaceContainerHighest,
  'textLink.activeForeground': c.primary,
  'textLink.foreground': c.primary,
  'textPreformat.foreground': c.tertiary,
  'textSeparator.foreground': c.outlineVariant,
  'titleBar.activeBackground': c.surfaceContainerLowest,
  'titleBar.activeForeground': c.onSurface,
  'titleBar.border': c.surfaceContainerHigh,
  'titleBar.inactiveBackground': c.surfaceContainerLowest,
  'titleBar.inactiveForeground': c.outline,
  'toolbar.hoverBackground': c.surfaceContainerHigh,
  'toolbar.hoverOutline': '#00000000',
  'tree.indentGuidesStroke': c.outlineVariant,
  'tree.inactiveIndentGuidesStroke': c.surfaceContainerHighest,
  'walkThrough.embeddedEditorBackground': c.surfaceContainerLow,
  'welcomePage.background': c.surfaceContainerLow,
  'welcomePage.progress.background': c.surfaceContainerHighest,
  'welcomePage.progress.foreground': c.primary,
  'widget.border': c.outlineVariant,
  'window.activeBorder': '#00000000',
  'window.inactiveBorder': '#00000000',
});

function tokenScope(kind: string): string[] {
  switch (kind) {
    case 'keyword':
      return ['keyword', 'keyword.operator.new', 'keyword.operator.expression', 'punctuation.definition.keyword'];
    case 'keywordControl':
      return [
        'keyword.control',
        'keyword.control.flow',
        'keyword.control.import',
        'keyword.control.from',
        'keyword.control.return',
        'keyword.operator.logical',
        'keyword.operator.comparison',
      ];
    case 'storageType':
      return ['storage', 'storage.type', 'storage.modifier'];
    case 'function':
      return [
        'entity.name.function',
        'support.function',
        'meta.function-call',
        'meta.function-call.generic',
        'variable.function',
      ];
    case 'methodCall':
      return ['entity.name.method', 'meta.method-call', 'support.method'];
    case 'typeClass':
      return [
        'entity.name.type',
        'entity.name.class',
        'support.type',
        'support.class',
        'entity.name.type.class',
        'entity.name.type.interface',
        'entity.name.struct',
        'entity.name.enum',
      ];
    case 'typeInterface':
      return ['entity.name.type.interface', 'entity.name.interface', 'support.interface'];
    case 'variable':
      return ['variable', 'variable.other', 'variable.other.readwrite', 'meta.variable'];
    case 'property':
      return [
        'variable.other.property',
        'variable.other.object.property',
        'meta.object-literal.key',
        'variable.other.member',
        'support.variable.property',
      ];
    case 'parameter':
      return ['variable.parameter', 'meta.parameter'];
    case 'constant':
      return ['variable.other.constant', 'entity.name.constant', 'constant.other.symbol'];
    case 'string':
      return ['string', 'string.quoted', 'string.template', 'punctuation.definition.string'];
    case 'stringEscape':
      return ['constant.character.escape', 'string.regexp'];
    case 'number':
      return ['constant.numeric'];
    case 'boolean':
      return ['constant.language.boolean', 'constant.language'];
    case 'comment':
      return ['comment', 'comment.line', 'comment.block', 'punctuation.definition.comment'];
    case 'regex':
      return ['string.regexp'];
    case 'tag':
      return ['entity.name.tag', 'meta.tag', 'punctuation.definition.tag'];
    case 'attribute':
      return ['entity.other.attribute-name', 'meta.attribute'];
    case 'operator':
      return ['keyword.operator', 'keyword.operator.assignment', 'keyword.operator.arithmetic'];
    case 'punctuation':
      return ['punctuation', 'punctuation.separator', 'punctuation.terminator', 'punctuation.definition.block'];
    case 'heading':
      return ['markup.heading', 'entity.name.section'];
    case 'link':
      return ['markup.underline.link', 'string.other.link'];
    case 'emphasis':
      return ['markup.italic'];
    case 'strong':
      return ['markup.bold'];
    case 'invalid':
      return ['invalid', 'invalid.illegal', 'invalid.broken'];
    case 'gutter':
      return [];
    default:
      return [];
  }
}

/** Semantic token selectors use the same kinds and style as TextMate rules. */
const SEMANTIC_KINDS: Record<string, string> = {
  namespace: 'typeClass',
  type: 'typeClass',
  class: 'typeClass',
  enum: 'typeClass',
  interface: 'typeInterface',
  struct: 'typeClass',
  typeParameter: 'typeInterface',
  parameter: 'parameter',
  variable: 'variable',
  property: 'property',
  'variable.readonly': 'constant',
  'property.readonly': 'constant',
  enumMember: 'constant',
  function: 'function',
  method: 'methodCall',
  macro: 'constant',
  decorator: 'function',
  event: 'property',
  label: 'property',
  keyword: 'keyword',
  modifier: 'storageType',
  comment: 'comment',
  string: 'string',
  number: 'number',
  regexp: 'regex',
  operator: 'operator',
};

export function generateTheme(opts: GenerateThemeOptions): WriteableTheme {
  const { colors: c, isDark, syntaxStyle } = opts;
  const palette = TOKEN_PALETTES[syntaxStyle] ?? TOKEN_PALETTES['material'];
  const backgroundTone = Hct.fromInt(argbFromHex(c.surface)).tone;
  const codeColor = (kind: string): string => {
    const color = c[palette[kind]];
    const hct = Hct.fromInt(argbFromHex(color));
    const minimum = kind === 'comment' ? 3 : 4.5;
    if (Contrast.ratioOfTones(hct.tone, backgroundTone) >= minimum) return color;
    // Retain palette hue/chroma while moving text away from the editor background.
    const tone = backgroundTone < 50
      ? Contrast.lighterUnsafe(backgroundTone, minimum + 0.1)
      : Contrast.darkerUnsafe(backgroundTone, minimum + 0.1);
    return hexFromArgb(Hct.from(hct.hue, hct.chroma, tone).toInt()).toUpperCase();
  };

  const kindIsDark = isDark;
  const theme: WriteableTheme = {
    name: 'WallTheme',
    type: kindIsDark ? 'dark' : 'light',
    colors: { ...editor(c), ...workbench(c, kindIsDark) },
    tokenColors: [],
    semanticHighlighting: true,
    semanticTokenColors: {},
  };

  for (const kind of Object.keys(palette)) {
    const scopes = tokenScope(kind);
    if (scopes.length === 0) continue;
    theme.tokenColors.push({ scope: scopes, settings: { foreground: codeColor(kind) } });
  }

  // Base text fallback.
  theme.tokenColors.unshift({
    scope: ['source'],
    settings: { foreground: c.onSurface },
  });

  for (const [semantic, kind] of Object.entries(SEMANTIC_KINDS)) {
    theme.semanticTokenColors[semantic] = codeColor(kind);
  }

  return theme;
}

export type { WriteableTheme as VsCodeTheme };
