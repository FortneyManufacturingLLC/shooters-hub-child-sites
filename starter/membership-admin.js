import {mountMembershipAdmin} from './membership-view.mjs';
// The server adapter supplies presentation scope and authenticated request ownership.
const integration=window.HubMembershipAdmin||{};
mountMembershipAdmin(integration);
