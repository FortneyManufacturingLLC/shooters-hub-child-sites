export interface Rule { id:string; text:string; number?:string; section?:string; topic?:string; conflictKey?:string; block?:{marker?:string;level?:number;listId?:string}; sourceParagraph?:number; [metadata:string]:unknown; }
export interface RulebookRevision { schemaVersion:1; rulebookId:string; revisionId:string; label:string; source:{sha256:string;filename:string}; rules:Rule[]; }
export interface ValidationResult { valid:boolean; errors:string[]; }
export interface Entity { type:'community'|'series'|'season'|'club'|'venue'|'match'; id:string; }
export interface InheritanceEdge { child:Entity; parent:Entity; }
export interface RuleAssignment { id:string; entity:Entity; role:'competition'|'host'|'venue'|'supplement'; rulebookId:string; revisionId:string; mandatory?:boolean; replaces?:string[]; }
export interface RuleCitation { rulebookId:string; revisionId:string; ruleId:string; key:string; }
export interface ResolvedRule extends Rule { citation:RuleCitation; assignmentIds:string[]; }
export interface RulesConflict { code:string; assignmentIds:string[]; detail:string; }
export interface RulesResolution { schemaVersion:1; entity:Entity; edges:InheritanceEdge[]; status:'resolved'|'conflict'; assignments:RuleAssignment[]; consideredAssignments:RuleAssignment[]; revisions:RulebookRevision[]; rules:ResolvedRule[]; conflicts:RulesConflict[]; }
export interface RuleDiffPart { type:'equal'|'insert'|'delete'; text:string; }
export interface RevisionComparison { additions:Rule[]; removals:Rule[]; modifications:{ruleId:string;before:Rule;after:Rule;diff:RuleDiffPart[]}[]; moves:{ruleId:string;from:number;to:number}[]; }
export interface RulesSnapshot { schemaVersion:1; type:'competition.rules-snapshot'; locked:true; matchId:string; lockedAt:string; completedAt?:string; resolution:RulesResolution; }
export declare function validateRevision(input:unknown):ValidationResult;
export declare function compareRevisions(before:RulebookRevision,after:RulebookRevision):RevisionComparison;
export declare function citationFor(revision:RulebookRevision,ruleId:string):Readonly<RuleCitation>;
export declare function resolveRules(assignments:RuleAssignment[],revisions:RulebookRevision[],options:{entity:Entity;edges?:InheritanceEdge[]}):RulesResolution;
export declare function lockSnapshot(resolution:RulesResolution,options:{matchId:string;lockedAt?:string;completedAt?:string;existingSnapshot?:RulesSnapshot}):RulesSnapshot;
export declare function verifySnapshot(snapshot:unknown):ValidationResult;
