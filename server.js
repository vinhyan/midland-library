const express = require('express');
const app = express();
const path = require('path');

const HTTP_PORT = process.env.PORT || 8080;

//************************************************//
//*                 MIDDLEWARE                   *//
//************************************************//

//======== ASSETS ========//
app.use(express.static(path.join(__dirname, 'assets')));

//======== HANDLEBARS ========//
const exphbs = require('express-handlebars');
app.engine(
  '.hbs',
  exphbs.engine({
    extname: '.hbs',
    helpers: {
      json: (context) => {
        return JSON.stringify(context);
      },
    },
  })
);
app.set('view engine', '.hbs');
app.use(express.urlencoded({ extend: true }));

//======== SESSION ========//
const session = require('express-session');

app.use(
  session({
    secret: 'random string',
    resave: false,
    saveUninitialized: true,
  })
);

//======== DOTENV ========//
const dotenv = require('dotenv');
dotenv.config({ path: './config/keys.env' });
//======== BCRYPTJS ========//
// const bcrypt = require('bcryptjs');

//************************************************//
//*                   DATABASE                   *//
//************************************************//

const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_CONN_STRING, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const Schema = mongoose.Schema;

//======== BOOK COLLECTION ========//

// Author (string)
// Title (string)
// borrowedBy (string) → the library card number of the user who borrowed the book. By default,
// this should be set to an empty string.
// img (string) → url or filename of a photo of the book
// desc (string) → short description of the book

// [{
//     "author": "Ann Napolitano",
//     "title": "Hello Beautiful (Oprah's Book Club): A Novel",
//     "isBorrowed": false,
//     "borrowBy": "",
//     "img": "/images/HelloBeautiful.jpg",
//     "desc": "From the New York Times bestselling author of Dear Edward comes a “powerfully affecting” (People) family story that asks: Can love make a broken person whole?"
// },
// {
//     "author": "Gabor Maté MD",
//     "title": "The Myth of Normal: Trauma, Illness and Healing in a Toxic Culture",
//     "isBorrowed": false,
//     "borrowBy": "",
//     "img": "/images/TheMythofNormal.jpg",
//     "desc": "This riveting and beautifully written tale has profound implications for all of our lives, including the practice of medicine and mental health.” —Bessel van der Kolk, MD, #1 New York Times bestselling author of The Body Keeps the Score"
// },
// {
//     "author": "Colleen Hoover",
//     "title": "Verity",
//     "isBorrowed": false,
//     "borrowBy": "",
//     "img": "/images/Verity.jpg",
//     "desc": "Whose truth is the lie? Stay up all night reading the sensational psychological thriller that has readers obsessed, from the #1 New York Times bestselling author of It Ends With Us."
// },
// {
//     "author": "Paulo Coelho",
//     "title": "The Alchemist",
//     "isBorrowed": false,
//     "borrowBy": "",
//     "img": "/images/TheAlchemist.jpg",
//     "desc": "A special 25th anniversary edition of the extraordinary international bestseller, including a new Foreword by Paulo Coelho."
// },
// {
//     "author": "Gabrielle Zevin",
//     "title": "Tomorrow, and Tomorrow, and Tomorrow: A novel",
//     "isBorrowed": false,
//     "borrowBy": "",
//     "img": "/images/Tomorrow.jpg",
//     "desc": "In this exhilarating novel by the best-selling author of The Storied Life of A. J. Fikry two friends—often in love, but never lovers—come together as creative partners in the world of video game design, where success brings them fame, joy, tragedy, duplicity, and, ultimately, a kind of immortality."
// }]

const bookSchema = new Schema({
  author: String,
  title: String,
  isBorrowed: Boolean,
  borrowBy: String,
  img: String,
  desc: String,
});

const Book = mongoose.model('books_collections', bookSchema);

//======== USER COLLECTION ========//
// Library card number (string)
// Use the following library card numbers:
//      0000
//      1234
// [{
//     "cardNumber": "0000",
//     "name": "John"
// },{
//     "cardNumber": "1234",
//     "name": "Leah"
// }]

const userSchema = new Schema({
  cardNumber: String,
  name: String,
});

const User = mongoose.model('libUsers_collections', userSchema);

//************************************************//
//*                  ENDPOINTS                   *//
//************************************************//

//======== HOME PAGE ========// (View: anyone. Borrow books: Logged In)

app.get('/', async (req, res) => {
  const isLoggedIn = req.session.loggedIn;
  const username = req.session.username;
  try {
    const booksFromDB = await Book.find().lean();

    if (booksFromDB === 0) {
      return res.render('error', {
        layout: 'primary',
        message: 'No more books available',
      });
    }

    return res.render('home', {
      layout: 'primary',
      books: booksFromDB,
      isLoggedIn: isLoggedIn,
      username: username,
    });
  } catch (err) {
    console.log(err);
  }
});

app.post('/borrow/:id', async (req, res) => {
  const isLoggedIn = req.session.loggedIn;
  const bookIdFromUI = req.params.id;
  const userCardNum = req.session.cardNumber;
  console.log(`[DEBUG] /borrow isLoggedIn from session: ${isLoggedIn}`);
  console.log(`[DEBUG] /borrow _id from UI: ${bookIdFromUI}`);
  console.log(
    `[DEBUG] /borrow cardNumber from session from UI: ${userCardNum}`
  );

  try {
    if (!isLoggedIn) {
      return res.render('error', {
        layout: 'primary',
        message: 'Please log in to borrow this book',
      });
    }

    const bookFromDB = await Book.findOne({ _id: bookIdFromUI });

    if (bookFromDB === null) {
      return res.render('error', {
        layout: 'primary',
        message: 'This book is cannot be found',
      });
    }

    bookFromDB.borrowBy = userCardNum;
    bookFromDB.isBorrowed = true;
    await bookFromDB.save();
    return res.redirect('/');
  } catch (err) {
    console.log(err);
  }
});

//======== LOG IN PAGE ========// (Any USER can VIEW on this)

app.get('/login', async (req, res) => {
  const isLoggedIn = req.session.loggedIn;
  const username = req.session.username;
  return res.render('login', {
    layout: 'primary',
    isLoggedIn: isLoggedIn,
    username: username,
  });
});

app.post('/login', async (req, res) => {
  const cardNumFromUI = req.body.cardNum;
  console.log(
    `[DEBUG] /login cardNum from UI: ${cardNumFromUI} with type ${typeof cardNumFromUI}`
  );
  try {
    userFromDB = await User.findOne({ cardNumber: cardNumFromUI });

    if (userFromDB === null) {
      return res.render('error', {
        layout: 'primary',
        message: 'Invalid Card Number',
      });
    }

    req.session.username = userFromDB.name;
    req.session.cardNumber = userFromDB.cardNumber;
    req.session.loggedIn = true;

    console.log('User permission info: ');
    console.log(req.session);

    return res.redirect('/');
  } catch (err) {
    console.log(err);
  }
});

//======== PROFILE PAGE ========// (Logged In: shows profile page. Not logged in: Error page)
app.get('/profile', async (req, res) => {
  const isLoggedIn = req.session.loggedIn;
  const username = req.session.username;

  try {
    if (!isLoggedIn) {
      return res.render('error', {
        layout: 'primary',
        message: 'Please log in to see your profile',
      });
    }

    const cardNumber = req.session.cardNumber;

    const booksFromDB = await Book.find({ borrowBy: cardNumber }).lean();

    if (booksFromDB.length === 0) {
      return res.render('error', {
        layout: 'primary',
        message: 'You are not borrowing any books',
        isLoggedIn: isLoggedIn,
        username: username,
      });
    }

    return res.render('profile', {
      layout: 'primary',
      books: booksFromDB,
      isLoggedIn: isLoggedIn,
      username: username,
    });
  } catch (err) {
    console.log(err);
  }
});

app.post('/return/:id', async (req, res) => {
  const isLoggedIn = req.session.loggedIn;
  const username = req.session.username;
  const bookIdFromUI = req.params.id;
  console.log(`[DEBUG] /return book ID is ${bookIdFromUI}`);

  try {
    const bookFromDB = await Book.findOne({ _id: bookIdFromUI });
    if (bookFromDB === null) {
      return res.render('error', {
        layout: 'primary',
        message: 'Something went wrong, this book cannot be found!',
      });
    }

    bookFromDB.borrowBy = '';
    bookFromDB.isBorrowed = false;
    await bookFromDB.save();
    // const success = true;

    return res.render('error', {
      layout: 'primary',
      message: 'You have returned sucessfully',
      success: true,
      isLoggedIn: isLoggedIn,
      username: username,
    });
  } catch (err) {
    console.log(err);
  }
});

//======== LOG OUT PAGE ========// (Any USER can CLICK on this)

app.post('/logout', (req, res) => {
  req.session.loggedIn = false;
  return res.render('logout', { layout: 'primary' });
});

const httpOnStart = () => {
  console.log(`Server is starting on port ${HTTP_PORT}...`);
  console.log(`Press Ctrl + C to quit.`);
};

app.listen(HTTP_PORT, httpOnStart);
