We want to implement a feature which allos non identical paris to be matched.
So a Match can consist of two different items. Which are defined to be matching.

Steps to go there.
1. Extract the cards into its own component.
2. Extend the backend to allow for Text baed cards. 
   This means a card can now be either an image or an markdown formated string.
   For this the description.json file inside the collections sould get a new paramether. "Pairs".
   Each pair consits of two elementes. Each alement can be either a link to an image or an text.
   example:
   {
    "Title:": "TUX",
    "Description": "A colection of linux tux Penguins",
    "Source": "Most of the images came from https://freesvg.org/1504115848",
    "Icon": "Linux-Pinguino.svg"
    "Pairs": [
      [ { "image" : "image1.svg"}], // if only one item is specified in a pair. The pair consits of two idential items
      [ { "image" : "cinema-penguin.svg"},{"image":"1462531704.svg"} ],
      [ {"markdown":"Python"},{"image":"python.png"}],
      [ {"markdown":"Python"},{"markdown":"A Programming Language"} ]
    ]
    }

   If Pairs is not Present in the desciption.json the backand soloud creat is by listing the directory as it currently does of find the images.
3. Create a new collection named Hallow World.
   search for the 16 most common programming languages.
   Each pair consists of the name of the Programming language and a hallow world programm in this language.
4. Add support to the frontent to be able to render markdown based Cards.
