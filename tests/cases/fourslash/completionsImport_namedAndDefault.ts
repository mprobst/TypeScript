/// <reference path="fourslash.ts" />

//@noEmit: true

// @Filename: /a.d.ts
////declare namespace foo {
////  class Bar {}  
////}
////declare module 'path1' {
////  import Bar = foo.Bar;
////  export default Bar;  
////}
////declare module 'path2longer' {
////  import Bar = foo.Bar;
////  export {Bar};
////}

// @Filename: /b.ts
////export {};
////Ba/**/;

verify.completions({
  marker: '',
  exact: [
    completion.globalThisEntry, ...completion.globalsVars, {
      name: 'foo',
      // source: '/a',
      // sourceDisplay: '/a',
      text: 'namespace foo',
      kind: 'module',
      kindModifiers: 'declare',
      // hasAction: true,
      sortText: completion.SortText.GlobalsOrKeywords
    },
    completion.undefinedVarEntry, {
      name: 'Bar',
      source: 'path1',
      sourceDisplay: 'path1',
      text: `(alias) class foo.Bar
export default Bar`,
      kind: 'alias',
      kindModifiers: 'declare,export',
      hasAction: true,
      sortText: completion.SortText.AutoImportSuggestions
    },
    {
      name: 'Bar',
      source: 'path2longer',
      sourceDisplay: 'path2longer',
      text: `(alias) class Bar
export Bar`,
      kind: 'alias',
      kindModifiers: 'declare',
      hasAction: true,
      sortText: completion.SortText.AutoImportSuggestions
    },
    ...completion.globalKeywords
  ],
  preferences: {includeCompletionsForModuleExports: true},
});
verify.applyCodeActionFromCompletion("", {
  name: "Bar",
  source: "path2longer",
  description: `Import default 'Bar' from module "path1"`,
  newFileContent:
`import Bar from "path2longer";

export {};
Ba;`
});