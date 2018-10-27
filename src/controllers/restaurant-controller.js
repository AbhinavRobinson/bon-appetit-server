const debug = require('debug')('bon-appetit-api:restaurant-controller');

const RestaurantDAO = require('../dao/restaurant-dao');
const DishesDAO = require('../dao/dishes-dao');
const ReviewDAO = require('../dao/review-dao');


const calculateDistanceCoordinates = require('../utils/calculate-distance-coordinates');
const shuffleArray = require('../utils/shuffle-array');

const _getDishesArray = (dishes, disheType, allReviews) => {
  const dishesFiltered = dishes.filter(dishe => dishe.type === disheType)
  const shuffledArray = shuffleArray(dishesFiltered);
  
  const MAX_VALUE_RANDOM_NUMBER = dishes.length;
  const MIN_VALUE_RANDOM_NUMBER = 1;

  const randomNumber = Math.floor(Math.random() * (MAX_VALUE_RANDOM_NUMBER - MIN_VALUE_RANDOM_NUMBER + 1)) + MIN_VALUE_RANDOM_NUMBER;

  const shuffledDishesArray = shuffledArray.slice(0, randomNumber);

  const disheArray = shuffledDishesArray.map(shuffledDishe => ({
    userReviews: allReviews.slice(0, shuffledDishe.reviews),
    description: shuffledDishe.description,
    ingredients: shuffledDishe.ingredients,
    imageURL: shuffledDishe.imageURL,
    reviews: shuffledDishe.reviews,
    stars: shuffledDishe.stars,
    price: shuffledDishe.price,
    title: shuffledDishe.title,
    type: shuffledDishe.type,
    id: shuffledDishe._id,
  })); 

  return disheArray;
};

const _getRestaurantMenu = async (dishesTypes) => {
  const dishes = await DishesDAO.readBasedDishesType(dishesTypes);
  
  const allReviews = await ReviewDAO.readAll();
  const reviewsShuffled = shuffleArray(allReviews);

  const menu = [];

  dishesTypes.forEach(disheType => {
    menu.push({
      dishes: _getDishesArray(dishes, disheType, reviewsShuffled),
      type: [disheType],
    });
  });

  return menu;
};

const _filterRestaurantsBasedDistance = (restaurantsDataset, maxDistance, userLocation) => {
  const restaurants = restaurantsDataset.filter(restaurant => {
    const { coordinates } = restaurant.location;

    const distanceBetweenCoordinates = calculateDistanceCoordinates(userLocation, {
      latitude: coordinates[0],
      longitude: coordinates[1],
    });

    const isInsideSearchRadius = (distanceBetweenCoordinates <= maxDistance);

    return isInsideSearchRadius;
  }).map(restaurant => ({
    id: restaurant._id,
    name: restaurant.name,
    imageURL: restaurant.imageURL,
    address: restaurant.location.address,
    stars: restaurant.stars,
  }));

  return restaurants;
};

const _getAllRestaurants = async (maxDistance, userLocation) => {
  const allRestaurants = await RestaurantDAO.readAll();

  const restaurants = _filterRestaurantsBasedDistance(allRestaurants, maxDistance, userLocation);

  return restaurants;
};

const _getFilteredRestaurants = async (dishesTypes, maxDistance, userLocation) => {
  const dishes = (Array.isArray(dishesTypes) ? dishesTypes : [dishesTypes]);
  
  const restaurantsFilteredByDishesTypes = await RestaurantDAO.filterBasedDishesTypes(dishes);
  const restaurantsParsed = restaurantsFilteredByDishesTypes.map(item => item.restaurants[0]);  
  const restaurants = _filterRestaurantsBasedDistance(restaurantsParsed, maxDistance, userLocation);  
  
  return restaurants;
}

exports.create = async (req, res, next) => {
  try {
    await RestaurantDAO.create(req.body);

    return res.status(201).json({
      message: 'Restaurants created with Success!',
    });
  } catch (err) {
    debug(err);

    return res.status(500).json({
      message: 'Error when trying to Create Restaurant.',
    });
  }
};

exports.readAll = async (req, res, next) => {
  try {
    const restaurants = await RestaurantDAO.readAll();

    return res.status(200).json({
      restaurants,
    });
  } catch (err) {
    debug(err);

    return res.status(500).json({
      message: 'Error when trying to Read All Restaurant.',
    });
  }
};

exports.readById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        message: `The field 'id' mandatory.`,
      });
    }

    const restaurantFromDB = await RestaurantDAO.readById(id);
    
    const userLocation = {
      latitude: parseFloat(req.headers.userlatitude),
      longitude: parseFloat(req.headers.userlongitude),
    };

    const distanceBetweenCoordinates = calculateDistanceCoordinates(userLocation, {
      latitude: restaurantFromDB.location.coordinates[0],
      longitude: restaurantFromDB.location.coordinates[1],
    });

    const menu = await _getRestaurantMenu(restaurantFromDB.dishesTypes);

    const restaurant = {
      operatingHours: restaurantFromDB.operatingHours,
      distance: distanceBetweenCoordinates.toFixed(1),
      description: restaurantFromDB.description,
      imageURL: restaurantFromDB.imageURL,
      location: restaurantFromDB.location,
      isOpen: restaurantFromDB.isOpen,
      stars: restaurantFromDB.stars,
      name: restaurantFromDB.name,
      id: restaurantFromDB._id,
    };

    return res.status(200).json({
      restaurant,
      menu,
    });
  } catch (err) {
    debug (err);

    return res.status(500).json({
      message: 'Error when trying to Read Restaurant.',
    });
  }
};

exports.readByDishesType = async (req, res, next) => {
  const { dishesType } = req.query;

  const userLocation = {
    latitude: parseFloat(req.headers.userlatitude),
    longitude: parseFloat(req.headers.userlongitude),
  };

  try {
    const restaurantsFilteredByDishesTypes = await RestaurantDAO.filterBasedDishesTypes([dishesType]);

    const restaurants = restaurantsFilteredByDishesTypes.map(item => {
      const { coordinates } = item.restaurants[0].location;
      
      const distanceBetweenCoordinates = calculateDistanceCoordinates(userLocation, {
        latitude: coordinates[0],
        longitude: coordinates[1],
      });

      return {
        id: item.restaurants[0]._id,
        stars: item.restaurants[0].stars,
        description: item.restaurants[0].description,
        name: item.restaurants[0].name,
        imageURL: item.restaurants[0].imageURL,
        location: {
          latitude: item.restaurants[0].location.coordinates[0],
          longitude: item.restaurants[0].location.coordinates[1],
        },
        isOpen: item.restaurants[0].isOpen,
        distance: distanceBetweenCoordinates.toFixed(1),
      };
    }).sort((first, second) => {
      return first.distance - second.distance;
    });

    return res.status(200).json({
      restaurants,
    });
  } catch (err) {
    debug(err);

    return res.status(500).json({
      message: 'Error when trying to Read by Dishe Type.',
    });
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        message: `The field 'id' mandatory.`,
      });
    }

    const restaurantUpdated = await RestaurantDAO.update(id, { ...req.body });

    if (restaurantUpdated) {
      return res.status(200).json({
        restaurantUpdated,
      });
    }

    return res.status(404).json({
      message: 'Restaurant Not Found',
    });
  } catch (err) {
    debug(err);

    return res.status(500).json({
      message: 'Error when trying to Update Restaurant.',
    });
  }
};

exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;

    const restaurantDeleted = await RestaurantDAO.delete(id);

    if (restaurantDeleted) {
      return res.status(200).json({
        message: 'Restaurant Deleted with Success!',
      });
    }

    return res.send(404).json({
      message: 'Restaurant Not Found',
    });
  } catch (err) {
    debug (err);

    return res.status(500).json({
      message: 'Error when trying to Delete Restaurant.',
    });
  }
};

exports.filter = async (req, res, next) => {
  try {
    const { dishesTypes, maxDistance } = req.query;

    const userLocation = {
      latitude: parseFloat(req.headers.userlatitude),
      longitude: parseFloat(req.headers.userlongitude),
    };

    const restaurants =
      dishesTypes === 'all'
      ? await _getAllRestaurants(maxDistance, userLocation)
      : await _getFilteredRestaurants(dishesTypes, maxDistance, userLocation);

    return res.status(200).json({
      restaurants,
    });
  } catch (err) {
    debug(err);

    return res.status(500).json({
      message: 'Error when trying to Filter Restaurants.',
    });
  }
};
