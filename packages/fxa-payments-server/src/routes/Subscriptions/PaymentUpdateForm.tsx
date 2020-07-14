/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import React, { useCallback, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Localized } from '@fluent/react';
import dayjs from 'dayjs';
import {
  getLocalizedDateString,
  getLocalizedDate,
  getLocalizedCurrency,
  formatPlanPricing,
} from '../../lib/formats';
import { useNonce } from '../../lib/hooks';
import { useBooleanState } from 'fxa-react/lib/hooks';
import { getErrorMessage } from '../../lib/errors';
import { SelectorReturns } from '../../store/selectors';
import {
  Customer,
  CustomerSubscription,
  Plan,
  PlanInterval,
} from '../../store/types';
import { metadataFromPlan } from 'fxa-shared/subscriptions/metadata';
import PaymentForm from '../../components/PaymentForm';
import ErrorMessage from '../../components/ErrorMessage';
import { SubscriptionsProps } from './index';
import * as Amplitude from '../../lib/amplitude';
import { apiCreateSetupIntent } from 'fxa-payments-server/src/lib/apiClient';
import { StripeProvider } from 'react-stripe-elements';
import { config } from '../../lib/config';

type PaymentUpdateFormProps = {
  customer: Customer;
  customerSubscription: CustomerSubscription;
  plan: Plan;
  resetUpdatePayment: SubscriptionsProps['resetUpdatePayment'];
  updatePayment: SubscriptionsProps['updatePayment'];
  updatePaymentStatus: SelectorReturns['updatePaymentStatus'];
  useSCAPaymentFlow: boolean;
};

function getBillingDescriptionText(
  name: string,
  amount: number,
  currency: string,
  interval: PlanInterval,
  intervalCount: number,
  date: number
): string {
  const formattedDateString = getLocalizedDateString(date, true);
  const planPricing = formatPlanPricing(
    amount,
    currency,
    interval,
    intervalCount
  );

  return `You are billed ${planPricing} for ${name}. Your next payment occurs on ${formattedDateString}.`;
}

async function handleSCA(tokenId: string) {
  //1. Create SetupIntent
  const filteredIntent = await apiCreateSetupIntent();

  const stripe = await loadStripe(config.stripe.apiKey);
  if (!stripe) {
    throw Error();
  }

  //2. Confirm SetupIntent
  const { setupIntent, error: confirmCardError } = stripe.confirmCardSetup(
    filteredIntent.client_secret,
    {
      payment_method: {
        card: {
          token: tokenId,
        },
      },
    }
  );
  if (confirmCardError) {
    return onFailure(confirmCardError);
  }
  if (!setupIntent) {
    return onFailure({ type: 'card_error' });
  }
}

export const PaymentUpdateForm = ({
  updatePayment: updatePaymentBase,
  updatePaymentStatus,
  resetUpdatePayment: resetUpdatePaymentBase,
  customer,
  customerSubscription,
  plan,
  useSCAPaymentFlow,
}: PaymentUpdateFormProps) => {
  const [submitNonce, refreshSubmitNonce] = useNonce();
  const [updateRevealed, revealUpdate, hideUpdate] = useBooleanState();
  const [createTokenError, setCreateTokenError] = useState({
    type: '',
    error: false,
  });

  const resetUpdatePayment = useCallback(async () => {
    resetUpdatePaymentBase();
    refreshSubmitNonce();
  }, [resetUpdatePaymentBase, refreshSubmitNonce]);

  const updatePayment = useCallback(
    async (...args: Parameters<typeof updatePaymentBase>) => {
      await updatePaymentBase(...args);
      refreshSubmitNonce();
    },
    [updatePaymentBase, refreshSubmitNonce]
  );

  const onRevealUpdateClick = useCallback(() => {
    resetUpdatePayment();
    revealUpdate();
  }, [resetUpdatePayment, revealUpdate]);

  const onPayment = useCallback(
    (tokenResponse: stripe.TokenResponse) => {
      if (tokenResponse && tokenResponse.token) {
        if (useSCAPaymentFlow) {
          // Use SetupIntents to Confirm the Card
          handleSCA(tokenResponse.token.id);
        }
        updatePayment(tokenResponse.token.id, plan);
      } else {
        // This shouldn't happen with a successful createToken() call, but let's
        // display an error in case it does.
        const error: any = { type: 'api_error', error: true };
        setCreateTokenError(error);
      }
    },
    [updatePayment, setCreateTokenError, plan]
  );

  const onPaymentError = useCallback(
    (error: any) => {
      error.error = true;
      setCreateTokenError(error);
    },
    [setCreateTokenError]
  );

  // clear any error rendered with `ErrorMessage`
  const onChange = useCallback(() => {
    setCreateTokenError({ type: '', error: false });
    resetUpdatePayment();
  }, [setCreateTokenError, resetUpdatePayment]);

  const onFormMounted = useCallback(
    () => Amplitude.updatePaymentMounted(plan),
    [plan]
  );

  const onFormEngaged = useCallback(
    () => Amplitude.updatePaymentEngaged(plan),
    [plan]
  );

  const inProgress = updatePaymentStatus.loading;

  const { upgradeCTA } = metadataFromPlan(plan);

  const { last4, exp_month, exp_year } = customer;

  // https://github.com/iamkun/dayjs/issues/639
  const expirationDate = dayjs()
    .set('month', Number(exp_month) - 1)
    .set('year', Number(exp_year))
    .format('MMMM YYYY');

  const billingDescriptionText = getBillingDescriptionText(
    plan.product_name,
    plan.amount,
    plan.currency,
    plan.interval,
    plan.interval_count,
    customerSubscription.current_period_end
  );

  return (
    <div className="payment-update">
      <h3 className="billing-title">
        <Localized id="sub-update-title">
          <span className="title">Billing Information</span>
        </Localized>
      </h3>
      <Localized
        id={`pay-update-billing-description-${plan.interval}`}
        $amount={getLocalizedCurrency(plan.amount, plan.currency)}
        $intervalCount={plan.interval_count}
        $name={plan.product_name}
        $date={getLocalizedDate(customerSubscription.current_period_end, true)}
      >
        <p className="billing-description">{billingDescriptionText}</p>
      </Localized>
      {upgradeCTA && (
        <p
          className="upgrade-cta"
          data-testid="upgrade-cta"
          dangerouslySetInnerHTML={{ __html: upgradeCTA }}
        />
      )}
      {!updateRevealed ? (
        <div className="with-settings-button">
          <div className="card-details">
            {last4 && expirationDate && (
              <>
                {/* TODO: Need to find a way to display a card icon here? */}
                <Localized id="sub-update-card-ending" $last={last4}>
                  <div className="last-four">Card ending {last4}</div>
                </Localized>
                <Localized
                  id="pay-update-card-exp"
                  $expirationDate={expirationDate}
                >
                  <div data-testid="card-expiration-date" className="expiry">
                    Expires {expirationDate}
                  </div>
                </Localized>
              </>
            )}
          </div>
          <div className="action">
            <button
              data-testid="reveal-payment-update-button"
              className="settings-button"
              onClick={onRevealUpdateClick}
            >
              <Localized id="pay-update-change-btn">
                <span className="change-button">Change</span>
              </Localized>
            </button>
          </div>
        </div>
      ) : (
        <>
          <ErrorMessage isVisible={!!createTokenError.error}>
            {createTokenError.error && (
              <p data-testid="error-payment-submission">
                {getErrorMessage(createTokenError.type)}
              </p>
            )}
          </ErrorMessage>

          <ErrorMessage isVisible={!!updatePaymentStatus.error}>
            {updatePaymentStatus.error && (
              <p data-testid="error-billing-update">
                {updatePaymentStatus.error.message}
              </p>
            )}
          </ErrorMessage>

          <PaymentForm
            {...{
              submitNonce,
              onPayment,
              onPaymentError,
              inProgress,
              confirm: false,
              onCancel: hideUpdate,
              onChange,
              onMounted: onFormMounted,
              onEngaged: onFormEngaged,
            }}
          />
        </>
      )}
    </div>
  );
};

export default PaymentUpdateForm;
