/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 *
 */
import _ from 'underscore';
import Cocktail from 'cocktail';
import FormView from '../../form';
import ServiceMixin from '../..//mixins/service-mixin';
import Template from 'templates/post_verify/secondary_email/add_secondary_email.mustache';

class AddSecondaryEmail extends FormView {
  template = Template;

  beforeRender() {}

  afterRender() {}

  getAccount() {
    return this.model.get('account');
  }

  setInitialContext(context) {
    const email = 'vbudhram@mozilla.com';
    context.set({
      email,
      escapedEmail: `<span class="email">${_.escape(email)}</span>`,
    });
  }
}

Cocktail.mixin(AddSecondaryEmail, ServiceMixin);

export default AddSecondaryEmail;
