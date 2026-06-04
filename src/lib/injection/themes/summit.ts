import { BaseThemeInjector } from "../base";

// Summit injector. The _meta slot map is pending port (status: pending-port),
// so injection currently throws via BaseThemeInjector.ready. When ported, this
// is also where the homepage hero desktop+mobile mirror and the nested-accordion
// FAQ handling will be overridden.
export class SummitInjector extends BaseThemeInjector {}
