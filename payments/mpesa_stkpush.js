const express = require("express");
const request = require("request");
const bodyParser = require("body-parser");
const app = express();
const cors = require("cors");

///-----Port-----///
const port = process.env.PORT1 || 3000;
const _urlencoded = express.urlencoded({ extended: false });
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

///----FireStore ----//


//----AllOW ACCESS -----//
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );

  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Methods", "PUT, POST, PATCH, DELETE, GET");
    return res.status(200).json({});
  }

  next();
});

let _checkoutRequestId, _UserID, _Username;

///------STK push Activate------/////

app.post("/stk", access, _urlencoded, function (req, res) {
  let _phoneNumber = req.body.phone;
  let _Amount = req.body.amount;
  _UserID = req.body.user_id;
  _Username = req.body.User_name;

  let endpoint = "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest";
  let auth = "Bearer " + req.access_token;

  let _shortCode = process.env.MP_SHORTCODE_DEV;
  let _passKey = process.env.MP_PASSKEY_DEV;

  const timeStamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, -3);
  const password = Buffer.from(`${_shortCode}${_passKey}${timeStamp}`).toString(
    "base64"
  );

  request(
    {
      url: endpoint,
      method: "POST",
      headers: {
        Authorization: auth,
      },

      json: {
        BusinessShortCode: _shortCode,
        Password: password,
        Timestamp: timeStamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: _Amount,
        PartyA: _phoneNumber,
        PartyB: _shortCode, //Till  No.
        PhoneNumber: _phoneNumber,
        CallBackURL: "https://paymentservice-production-75bf.up.railway.app/yayalink/stk_callback",
        AccountReference: "Yaya Nanies App",
        TransactionDesc: "_transDec",
      },
    },
    (error, response, body) => {
      if (error) {
        console.log(error);
        res.status(404).json(error);
      } else {
        res.status(200).json(body);
        console.log(body);
        console.log("USER_ID", _UserID);
        console.log("USER_Name", _Username);

        _checkoutRequestId = body.CheckoutRequestID;
        console.log("CHECKOUT_ID", _checkoutRequestId);
      }
    }
  );
});
//----MIDDLEWARE---///
const middleware = (req, res, next) => {
  req.checkoutID = _checkoutRequestId;
  req.uid = _UserID;
  req.name = _Username;
  next();
};

///------STK_CALLBACK-----///
app.post("/stk_callback", _urlencoded, middleware, function (req, res, next) {
  var transID = "";
  var amount = "";
  var transdate = "";
  var transNo = "";
  let _checkout_ID = req.checkoutID;
  let _Name = req.name;
  let _UID = req.uid;

  console.log(".......... STK Callback ..................");
  if (res.status(200)) {
    console.log("CheckOutId", _checkout_ID);

    res.json(req.body.Body.stkCallback.CallbackMetadata);
    console.log(req.body.Body.stkCallback.CallbackMetadata);

    if (
      (Balance =
        req.body.Body.stkCallback.CallbackMetadata.Item[2].Name == "Balance")
    ) {
      amount = req.body.Body.stkCallback.CallbackMetadata.Item[0].Value;
      transID = req.body.Body.stkCallback.CallbackMetadata.Item[1].Value;
      transNo = req.body.Body.stkCallback.CallbackMetadata.Item[4].Value;
      transdate = req.body.Body.stkCallback.CallbackMetadata.Item[3].Value;

  
     

     
    } else {
      amount = req.body.Body.stkCallback.CallbackMetadata.Item[0].Value;
      transID = req.body.Body.stkCallback.CallbackMetadata.Item[1].Value;
      transNo = req.body.Body.stkCallback.CallbackMetadata.Item[3].Value;
      transdate = req.body.Body.stkCallback.CallbackMetadata.Item[2].Value;

     
    }
  }
});
///----STK QUERY ---//
app.post("/stk/query", access, _urlencoded, function (req, res, next) {
  let _checkoutRequestId = req.body.checkoutRequestId;

  auth = "Bearer " + req.access_token;

  let endpoint = "https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query";
  let _shortCode = process.env.MP_SHORTCODE_DEV;
  let _passKey = process.env.MP_PASSKEY_DEV;

  const timeStamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, -3);
  const password = Buffer.from(`${_shortCode}${_passKey}${timeStamp}`).toString(
    "base64"
  );

  request(
    {
      url: endpoint,
      method: "POST",
      headers: {
        Authorization: auth,
      },

      json: {
        BusinessShortCode: _shortCode,
        Password: password,
        Timestamp: timeStamp,
        CheckoutRequestID: _checkoutRequestId,
      },
    },
    function (error, response, body) {
      if (error) {
        console.log(error);
        res.status(404).json(body);
      } else {
        res.status(200).json(body);
        console.log(body);
        next();
      }
    }
  );
});

///-------  Stk Registration-----////
let _BfName,
  _BureauImage,
  _BureauName,
  _BIdNo,
  _BBuilding,
  _BStreetName,
  _BCity,
  _BCounty,
  _BEmail,
  _BBox,
  _BPostalCode,
  _BPhone,
  _BAmount,
  _BUiD;
let _CheckoutRequestId;

app.post("/stk_register", access, _urlencoded, function (req, res) {
  _BPhone = req.body.Phone_NO;
  _BAmount = req.body.amount;
  _BUiD = req.body.user_id;
  _BfName = req.body.userName;

  let endpoint = "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest";
  let auth = "Bearer " + req.access_token;

  let _shortCode = "4087943";
  let _passKey =
    "bb2724f53956f05ca6772b8a79e193c88953048d221b8f4f47d96c9b8f641dbb";

  const timeStamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, -3);
  const password = Buffer.from(`${_shortCode}${_passKey}${timeStamp}`).toString(
    "base64"
  );

  request(
    {
      url: endpoint,
      method: "POST",
      headers: {
        Authorization: auth,
      },

      json: {
        BusinessShortCode: _shortCode,
        Password: password,
        Timestamp: timeStamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: _BAmount,
        PartyA: _BPhone,
        PartyB: _shortCode, //Till  No.
        PhoneNumber: _BPhone,
        CallBackURL: "https://paymentservice-production-75bf.up.railway.app/yayalink/stk_callback2",
        AccountReference: "Yaya Bureau App ",
        TransactionDesc: "_transDec",
      },
    },
    (error, response, body) => {
      if (error) {
        console.log(error);
        res.status(404).json(error);
      } else {
        res.status(200).json(body);
        console.log(body);
        console.log("USER_ID", _BUiD);
        _CheckoutRequestId = body.CheckoutRequestID;
        console.log("CHECKOUT_ID", _CheckoutRequestId);
      }
    }
  );
});
//----MIDDLEWARE---///
const middleware2 = (req, res, next) => {
  req.checkoutID = _CheckoutRequestId;
  req.uid = _BUiD;
  req.name = _BfName;
  next();
};

///------STK_CALLBACK-----///
app.post("/stk_callback2", _urlencoded, middleware2, function (req, res, next) {
  var transID = "";
  var amount = "";
  var transdate = "";
  var transNo = "";
  let _checkout_ID = req.checkoutID;
  let _UiD = req.uid;
  let _Name = req.name;
  var total_amount;
  console.log(".......... STK Callback ..................");
  if (res.status(200)) {
    console.log("CheckOutId", _checkout_ID);

    res.json(req.body.Body.stkCallback.CallbackMetadata);
    console.log(req.body.Body.stkCallback.CallbackMetadata);

    if (
      (Balance =
        req.body.Body.stkCallback.CallbackMetadata.Item[2].Name == "Balance")
    ) {
      amount = req.body.Body.stkCallback.CallbackMetadata.Item[0].Value;
      transID = req.body.Body.stkCallback.CallbackMetadata.Item[1].Value;
      transNo = req.body.Body.stkCallback.CallbackMetadata.Item[4].Value;
      transdate = req.body.Body.stkCallback.CallbackMetadata.Item[3].Value;

      

       
    } else {
      amount = req.body.Body.stkCallback.CallbackMetadata.Item[0].Value;
      transID = req.body.Body.stkCallback.CallbackMetadata.Item[1].Value;
      transNo = req.body.Body.stkCallback.CallbackMetadata.Item[3].Value;
      transdate = req.body.Body.stkCallback.CallbackMetadata.Item[2].Value;

   
    }
  }
});
///----STK QUERY ---//
app.post("/stk/query2", access, _urlencoded, function (req, res, next) {
  let _checkoutRequestId = req.body.checkoutRequestId;

  auth = "Bearer " + req.access_token;

  let endpoint = "https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query";
  let _shortCode = process.env.MP_SHORTCODE_DEV;
  let _passKey = process.env.MP_PASSKEY_DEV;

  const timeStamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, -3);
  const password = Buffer.from(`${_shortCode}${_passKey}${timeStamp}`).toString(
    "base64"
  );

  request(
    {
      url: endpoint,
      method: "POST",
      headers: {
        Authorization: auth,
      },

      json: {
        BusinessShortCode: _shortCode,
        Password: password,
        Timestamp: timeStamp,
        CheckoutRequestID: _checkoutRequestId,
      },
    },
    function (error, response, body) {
      if (error) {
        console.log(error);
        res.status(404).json(body);
      } else {
        res.status(200).json(body);
        console.log(body);
        next();
      }
    }
  );
});

////-----ACCESS_TOKEN-----
app.get("/access_token", access, (req, res) => {
  res.status(200).json({ access_token: req.access_token });
});

let consumer_key = process.env.MP_CONSUMER_KEY_DEV;
let consumer_secret = process.env.MP_SECRET_KEY_DEV;
function access(res, req, next) {
  let endpoint =
    "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
  let auth = new Buffer.from(
    consumer_key + ":" + consumer_secret
  ).toString("base64");

  request(
    {
      url: endpoint,
      headers: {
        Authorization: "Basic " + auth,
      },
    },
    (error, response, body) => {
      if (error) {
        console.log(error);
      } else {
        res.access_token = JSON.parse(body).access_token;
        console.log(body);
        next();
      }
    }
  );
}
///----END ACCESS_TOKEN---

/////-----Home ------/////
app.get("/", (req, res, next) => {
  res.status(200).send("Hello welcome to Yaya Mpesa API");
});

//-- listen
app.listen(port ,'0.0.0.0', (error) => {
  if (error) {
  } else {
    console.log(`Server running on port http://localhost:${port}`);
  }
});


module.exports = app;