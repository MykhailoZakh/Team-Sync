const { User, Project, List, Card } = require('../models');

const { signToken, AuthenticationError } = require('../utils/auth');

const resolvers = {
  Query: {
    users: async () => {
      return User.find();
    },
    user: async (parent, { username }) => {
      return User.findOne({ username }).populate('projects');
    },
    me: async (parent, args, context) => {
      if (context.user) {
        return User.findOne({ _id: context.user._id });
      }
      throw AuthenticationError;
    },
    projects: async () => {
      let projects = Project.find().populate({
        path: 'lists',
        populate: {
          path: "cards",
          populate: [{ path: "comments" }, { path: "toDoes" }]
        }
      }).populate('users');
      return projects
    },
    projectId: async (parent, { projectId }) => {
      return Project.findOne({ _id: projectId }).populate({
        path: 'lists',
        populate: {
          path: "cards",
          populate: [{ path: "comments" }, { path: "toDoes" }]
        }
      }).populate('users');
    }
  },

  Mutation: {
    addUser: async (parent, { username, email, password }) => {
      const user = await User.create({ username, email, password });
      const token = signToken(user);
      return { token, user };
    },
    login: async (parent, { email, password }) => {
      const user = await User.findOne({ email });

      if (!user) {
        throw AuthenticationError;
      }

      const correctPw = await user.isCorrectPassword(password);

      if (!correctPw) {
        throw AuthenticationError;
      }

      const token = signToken(user);

      return { token, user };
    },
    addProject: async (parent, { title, projectAuthor, authId }) => {
      const project = await Project.create({ title, users: [authId] });
      await User.findOneAndUpdate(
        { username: projectAuthor },
        { $addToSet: { projects: project._id } }
      );

      return project;
    },

    addList: async (parent, { title, projectId }) => {
      const list = await List.create({
        title, projectId: projectId
      });
      await Project.findOneAndUpdate({ _id: projectId }, { $addToSet: { lists: list._id } })

      return list;

    },

    addCard: async (parent, { title, listId, description, comments, toDoes }) => {
      const card = await Card.create({
        title, listId, description,
      });
      await List.findOneAndUpdate({ _id: listId }, { $addToSet: { cards: card._id } });
      return card
    },

    addComment: async (parent, { cardId, commentText, commentAuthor }) => {
      return Card.findOneAndUpdate(
        { _id: cardId },
        {
          $addToSet: { comments: { commentText, commentAuthor } },
        },
        {
          new: true,
          runValidators: true,
        }
      );
    },
    removeComment: async (parent, { cardId, commentId }) => {
      return Card.findOneAndUpdate(
        { _id: cardId },
        { $pull: { comments: { _id: commentId } } },
        { new: true }
      );
    },
    addToDo: async (parent, { cardId, text }) => {
      return Card.findOneAndUpdate(
        { _id: cardId },
        {
          $addToSet: { toDoes: { text } },
        },
        {
          new: true,
          runValidators: true,
        }
      );
    },
    removeToDo: async (parent, { cardId, toDoId }) => {
      return Card.findOneAndUpdate(
        { _id: cardId },
        { $pull: { toDoes: { _id: toDoId } } },
        { new: true }
      );
    },
    removeCard: async (parent, { cardId, listId }) => {
      let card = await Card.findOneAndDelete({ _id: cardId });
      await List.findOneAndUpdate({ _id: listId }, { $pull: { cards: card._id } });
      return card;
    },
    removeList: async (parent, { listId, projectId }) => {
      let list = await List.findOneAndDelete({ _id: listId });
      await Project.findOneAndUpdate({ _id: projectId }, { $pull: { lists: list._id } });
      return list;
    },
  },
};

module.exports = resolvers;
