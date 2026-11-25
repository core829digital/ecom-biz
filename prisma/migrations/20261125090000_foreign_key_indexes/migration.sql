-- CreateIndex
CREATE INDEX "AiConversation_userId_idx" ON "AiConversation"("userId");

-- CreateIndex
CREATE INDEX "AutomationRun_subscriberId_idx" ON "AutomationRun"("subscriberId");

-- CreateIndex
CREATE INDEX "CampaignSend_subscriberId_idx" ON "CampaignSend"("subscriberId");

-- CreateIndex
CREATE INDEX "Cart_customerId_idx" ON "Cart"("customerId");

-- CreateIndex
CREATE INDEX "CartLine_variantId_idx" ON "CartLine"("variantId");

-- CreateIndex
CREATE INDEX "Checkout_cartId_idx" ON "Checkout"("cartId");

-- CreateIndex
CREATE INDEX "Checkout_customerId_idx" ON "Checkout"("customerId");

-- CreateIndex
CREATE INDEX "Customer_storeId_createdAt_idx" ON "Customer"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerPasswordReset_customerId_idx" ON "CustomerPasswordReset"("customerId");

-- CreateIndex
CREATE INDEX "Fulfillment_orderId_idx" ON "Fulfillment"("orderId");

-- CreateIndex
CREATE INDEX "FulfillmentLine_fulfillmentId_idx" ON "FulfillmentLine"("fulfillmentId");

-- CreateIndex
CREATE INDEX "FulfillmentLine_orderLineId_idx" ON "FulfillmentLine"("orderLineId");

-- CreateIndex
CREATE INDEX "Order_storeId_status_fulfillmentStatus_idx" ON "Order"("storeId", "status", "fulfillmentStatus");

-- CreateIndex
CREATE INDEX "Order_storeId_email_idx" ON "Order"("storeId", "email");

-- CreateIndex
CREATE INDEX "OrderLine_productId_idx" ON "OrderLine"("productId");

-- CreateIndex
CREATE INDEX "OrderLine_variantId_idx" ON "OrderLine"("variantId");

-- CreateIndex
CREATE INDEX "PasswordReset_userId_idx" ON "PasswordReset"("userId");

-- CreateIndex
CREATE INDEX "Refund_orderId_idx" ON "Refund"("orderId");

-- CreateIndex
CREATE INDEX "ShippingRate_zoneId_idx" ON "ShippingRate"("zoneId");

-- CreateIndex
CREATE INDEX "TrialClaim_userId_idx" ON "TrialClaim"("userId");

-- CreateIndex
CREATE INDEX "User_planId_idx" ON "User"("planId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_subscriptionId_idx" ON "WebhookDelivery"("subscriptionId");
