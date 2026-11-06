export type ShareKind='article'|'brand'|'club'|'external'|'freedope'|'forum'|'group'|'listing'|'match'|'other'|'post'|'profile'|'results'|'search'|'season'|'series'|'stage'|'thread';
export interface ShareInput {id?:string;kind?:ShareKind;eyebrow?:string;title:string;summary?:string;href?:string;destination?:{webHref:string};metadata?:readonly string[];image?:{url:string;alt?:string};}
export interface ShareItem {readonly id:string;readonly kind:ShareKind;readonly eyebrow:string;readonly title:string;readonly summary?:string;readonly href:string;readonly metadata:readonly string[];readonly image?:Readonly<{url:string;alt:string}>;}
export interface ShareOptions {origin?:string;}
export interface ShareResult {id:string;kind:string;title:string;eyebrow?:string;summary?:string;destination?:{webHref:string;nativeRoute?:string};href?:string;dateIso?:string;startIso?:string;endIso?:string;endDateIso?:string;timeTbd?:boolean;timeZone?:string;locationLabel?:string;statusLabel?:string;distanceLabel?:string;}
export interface CalendarOptions extends ShareOptions {timeZone?:string;now?:Date|string;}
export declare const SHARE_LIMITS:Readonly<{results:1000;title:200;summary:2000;metadata:8;metadataText:160;href:4096}>;
export declare function normaliseShareItem(input:ShareInput,options?:ShareOptions):ShareItem;
export declare const shareItemFromEntity:typeof normaliseShareItem;
export declare function resultCsv(results:readonly ShareResult[]):string;
export declare function resultCalendar(results:readonly ShareResult[],options?:CalendarOptions):string|null;
export declare function googleCalendarHref(result:ShareResult,options?:ShareOptions):string|null;
