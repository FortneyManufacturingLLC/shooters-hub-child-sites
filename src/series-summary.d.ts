export type SeriesSummaryStatus = 'published' | 'published-empty' | 'partial' | 'withheld' | 'unavailable';
export interface SeriesSummaryItem { id:string; slug:string; title:string; shortDescription:string; plainTextDescription:string; canonicalHref:string; }
export interface SeriesSummary { schemaVersion:1; type:'competition.series-summary'; status:SeriesSummaryStatus; series:SeriesSummaryItem|null; }
export interface SeriesSummaryScope { seriesId?:string; seriesSlug?:string; }
export interface SeriesSummaryPresentation { headingLevel?:1|2|3|4|5|6; instanceId?:string; }
export interface SeriesSummaryReleaseArtifact { sha256:string; export:'./series-summary'; schemaVersion:1; rendererVersion:'1.0.0'; }
export interface SeriesSummaryHostAcknowledgment { releaseId:string; artifactSha256:string; schemaVersion:1; rendererVersion:'1.0.0'; }
export interface SeriesSummaryRelease { schemaVersion:1; type:'competition.series-summary.release'; releaseId:string; channel:'production'; public:true; artifact:SeriesSummaryReleaseArtifact; hosts:{parent:SeriesSummaryHostAcknowledgment;child:SeriesSummaryHostAcknowledgment}; previouslyJointlyCompatible:boolean; }
export interface SeriesSummaryReleaseOptions { servedReleaseId?:string; rollback?:boolean; }
export declare const SERIES_SUMMARY_TYPE:'competition.series-summary';
export declare const SERIES_SUMMARY_RENDERER_VERSION:'1.0.0';
export declare function validateSeriesSummary(input:unknown,scope?:SeriesSummaryScope):SeriesSummary;
export declare function renderSeriesSummary(input:unknown,options?:SeriesSummaryPresentation):string;
export declare function validateSeriesSummaryRelease(input:unknown,options?:SeriesSummaryReleaseOptions):SeriesSummaryRelease;
