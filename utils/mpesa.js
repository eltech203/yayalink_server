exports.parseMpesaCallback = (callback) => {
  const items = callback.CallbackMetadata.Item;

  const getValue = (name) => {
    const item = items.find(i => i.Name === name);
    return item ? item.Value : null;
  };

  return {
    amount: getValue("Amount"),
    mpesa_receipt: getValue("MpesaReceiptNumber"),
    phone: getValue("PhoneNumber"),
    transaction_date: getValue("TransactionDate")
  };
};
