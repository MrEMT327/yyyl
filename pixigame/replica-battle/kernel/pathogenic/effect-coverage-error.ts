export class SourceCoverageError extends Error {
  constructor(readonly details:any[]){super('Pathogenic source features require implementation: '+JSON.stringify(details));}
}
