/**
 * Serves as a namespace for functions that deal with grid
 * coordinates but don't do any kind of path finding.
 * @type {Object}
 */
var coordinate_functions = {
  /**
   * The taxicab metric for a 2d grid of points.
   * @param from The starting position.
   * @param to The ending position.
   * @return {Number} The distance from the starting position to the ending position.
   */
  manhattan_metric : function (from, to) {
    return Math.abs(from[0] - to[0]) + Math.abs(from[1] - to[1]);
  },
  /**
   * the start and end points can be in the following configurations:
   * s  +  o      o  -  s      o  +  e      e  -  o                              s      e
   * 1) +     +  2)  +     +  3)  -     -  4)  -     -  5)  s  +  e  6)  e - s  7)  +  8)  -
   * o  +  e      e  -  o      s  +  o      o  -  s                              e      s
   * we want to return coordinates that will make the box look like:
   * l  #  o
   * #     #  or   l # r
   * o  #  r
   * because we don't really care about how the path from start to end
   * is oriented.
   * @param start The starting point of the path.
   * @param end The ending point of the path.
   * @returns {Object} An object with "left", "right" properties that contains the
   * non-oriented coordinates.
   */
  box_coordinates_from_endpoints : function (start, end) {
    var col_delta = end[0] - start[0], row_delta = end[1] - start[1];
    var orientation = col_delta * row_delta;
    if (orientation === 0) { /* degenerate case of horizontal or vertical line */
      if (col_delta === 0) { /* vertical line, config 7) or 8)*/
        return row_delta > 0 ? {left : start, right : end} : {left : end, right : start};
      } else { /* row_delta === 0 : horizontal line, config 5) or 6) */
        return col_delta > 0 ? {left : start, right : end} : {left : end, right : start};
      }
    } else if (orientation > 0) { /* this is config 1) or 4) */
      if (col_delta > 0) { /* config 1) */
        return {left : start, right : end};
      } else { /* config 4) */
        return {left : end, right : start};
      }
    } else { /* orientation < 0 : this is config 2) or 3) */
      var shifted_start = [start[0] + col_delta, start[1]];
      var shifted_end = [end[0] - col_delta, end[1]];
      if (col_delta < 0) { /* config 2) */
        return {left : shifted_start, right : shifted_end};
      } else { /* config 4) */
        return {left : shifted_end, right : shifted_start};
      }
    }
  }
};

/**
 * Serves as the namespace for functions that do something with paths
 * from one endpoint to another.
 * @type {Object}
 */
var path_construction = {
  /**
   * Given a point that we consider a starting point we extend the partial
   * path already constructed towards that point. If the head of the partial
   * path is already the goal point then we stop extending the path.
   * @param goal The point we want to treat as the starting point of the path.
   * @param current_path An already constructed partial path that we want to extend.
   * @returns A list of possible path extensions of the partial path.
   */
  extend_path : function (goal, current_path) {
    var path_head = current_path[0];
    var delta_x = goal[0] - path_head[0], delta_y = goal[1] - path_head[1];
    var possible_new_nodes = [];
    if (delta_x !== 0) {
      if (delta_x > 0) {
        possible_new_nodes.push([path_head[0] + 1, path_head[1]]);
      } else {
        possible_new_nodes.push([path_head[0] - 1, path_head[1]]);
      }
    }
    if (delta_y !== 0) {
      if (delta_y > 0) {
        possible_new_nodes.push([path_head[0], path_head[1] + 1]);
      } else {
        possible_new_nodes.push([path_head[0], path_head[1] - 1]);
      }
    }
    return possible_new_nodes.length > 0 ?
      possible_new_nodes.map(function (node) { return [node].concat(current_path); }) : [current_path];
  },
  /**
   * Given a goal and a partial path we figure out if the partial path can be extended.
   * A partial path can be extended if the head of the list does not equal the goal point.
   * @param goal We want to extend the partial path to this point.
   * @param partial_path An already constructed path we want to test for extension.
   * @return {Boolean} True if the path can be extended and false otherwise.
   */
  can_extend : function(goal, partial_path) {
    return (goal[0] - partial_path[0][0]) !== 0 || (goal[1] - partial_path[0][1]) !== 0;
  },
  /**
   * Given a start and end point we construct the set of all paths
   * from start to end.
   * @param start Our starting point.
   * @param end Our ending point.
   * @return {Array} A list of paths from start to end.
   */
  construct_possible_paths : function (start, end) {
    if ((start[0] - end[0]) === 0 && (start[1] - end[1]) === 0) {
      throw "Can't construct path for points that coincide.";
    }
    var extender = function (path) { return this.extend_path(start, path); };
    var reducer = function (acc, extensions) { return acc.concat(extensions); };
    var extension_checker = function (partial_path) { return this.can_extend(start, partial_path); };
    var paths = [[end]];
    while (paths.some(extension_checker, this)) {
      paths = paths.map(extender, this).reduce(reducer, []);
    }
    return paths;
  },
  /**
   * Given a set of paths and a functions that maps paths to boolean values
   * this function returns the subset of paths that are mapped to true with
   * the filter function.
   * @param paths The set of paths we want to filter.
   * @param filter A function that maps paths to boolean values.
   * @returns {Array} A subset of the paths that are mapped to true by the filter
   * function.
   */
  filter_paths : function(paths, filter) {
    return paths.filter(filter);
  }
};

/**
 * this should serve as a prototype for other strategy constructors.
 * requires the constructor of the strategy that wants to use this as
 * a prototype to initialize fruit_locations and init.
 * @type {Object}
 */
var common_strategy_methods = {
  /**
   * similar to find_fruits but instead of going through each cell of the board
   * we only check the locations that we know had fruit to begin with.
   */
  update_fruits : function (board) {
    /*
     for each fruit recheck and reassign the locations of that
     fruit and at the same time update the list of fruits to ones
     that have a non-empty list of locations.
     */
    var fruits = this.fruit_stash.fruits;
    this.fruit_stash.fruits = fruits.filter(function (fruit) {
      var updated_locations = this.fruit_stash[fruit].filter(function (loc) {
        return board[loc[0]][loc[1]] > 0;
      });
      this.fruit_stash[fruit] = updated_locations;
      return updated_locations.length > 0;
    }, this);
  },
  /*
   go through the board and save all the fruit locations.
   also, while making a pass through the board we also keep
   track of how many fruits of that type we would need to
   get in order to win that category.
   */
  find_fruits_and_compute_win_counts : function (board) {
    board.forEach(function (column, col_index) {
      column.forEach(function (fruit_type, row_index) {
        var fruit_location = [col_index, row_index], fruit_locations;
        if (fruit_type > 0) {
          fruit_locations = this.fruit_stash[fruit_type];
          if (fruit_locations) {
            fruit_locations.push(fruit_location);
          } else {
            this.fruit_stash[fruit_type] = [fruit_location];
            this.fruit_stash.fruits.push(fruit_type);
            this.win_counts[fruit_type] = 0.5;
          }
          this.win_counts[fruit_type] += 0.5;
        }
      }, this);
    }, this);
  },
  /*
   the game has a predefined set of constants for directional movement.
   so given where we want to move and some other location this function
   returns one of the direction specifiers that will get us closer to
   the desired location.
   */
  calculate_move_direction : function (move_location, my_location) {
    // figure out if we need to move left or right
    var x_delta = move_location[0] - my_location[0];
    if (x_delta !== 0) {
      return x_delta > 0 ? EAST : WEST;
    }
    // figure out if we need to move left or right
    var y_delta = move_location[1] - my_location[1];
    if (y_delta !== 0) {
      return y_delta > 0 ? SOUTH : NORTH;
    }
  },
  /*
   convenience function for updating fruit locations. this
   should be called on every turn of the game to update the
   locations of the fruits.
   */
  init_or_update_fruit_locations : function (board) {
    if (!this.init) {
      this.find_fruits_and_compute_win_counts(board);
      this.init = true;
    } else {
      this.update_fruits(board);
    }
  },
  /*
   finds the closest fruit to a given location. will throw
   an exception or return null if fruit_stash and fruit_stash.fruits
   don't contain anything. so this function will only return sensible
   results if our fruit_stash is sane.
   */
  find_closest_fruit : function (loc) {
    var closest_fruit = null, closest_distance = Infinity, fruit_stash = this.fruit_stash;
    fruit_stash.fruits.forEach(function (fruit) {
      fruit_stash[fruit].forEach(function (fruit_loc) {
        var distance = coordinate_functions.manhattan_metric(loc, fruit_loc);
        if (distance <= closest_distance) {
          closest_distance = distance;
          closest_fruit = fruit_loc;
        }
      });
    });
    return closest_fruit;
  },
  /* given coordinates of some bounding box we return
  the locations of all the fruits that will fit in that box.
   */
  fruits_in_a_box : function (top_left_endpoint, bottom_right_endpoint) {
    var left_col_limit = top_left_endpoint[0], right_col_limit = bottom_right_endpoint[0];
    var top_row_limit = top_left_endpoint[1], bottom_row_limit = bottom_right_endpoint[1];
    var fruit_stash = this.fruit_stash, potential_fruit_locations = [];
    fruit_stash.fruits.forEach(function (fruit) {
      fruit_stash[fruit].filter(function (fruit_location) {
        /* check column limits */
        if (fruit_location[0] >= left_col_limit && fruit_location[0] <= right_col_limit) {
          /* check row limits */
          if (fruit_location[1] <= top_row_limit && fruit_location[1] >= bottom_row_limit) {
            potential_fruit_locations.push(fruit_location);
          }
        }
      });
    });
    return potential_fruit_locations;
  }
};

/**
 * Initializes strategy instances given a constructor that creates
 * an object instance that conforms to the game API.
 * @param Constructor A constructor that returns an instance of a strategy that conforms to the game API.
 * @return {Object} An instance that has its prototype linked to common_strategy_methods and
 * has various properties initialized to what is expected by the methods in common_strategy_methods.
 */
function create_strategy_instance(Constructor) {
  /* set prototype and create an instance. */
  Constructor.prototype = common_strategy_methods;
  var instance = new Constructor();
  /* initialize common state. */
  instance.init = false;
  instance.fruit_stash = {fruits : []};
  instance.win_counts = {};
  /* return the new instance. */
  return instance;
}

/*
 the idea here is to use win_counts to ignore fruits that are
 a lost cause and to go after fruits that can potentially get
 us a win. this still doesn't beat the greedy strategy of going
 after the closest fruit first.
 */
function Still_Pretty_Greedy() {
  /*
   we want to get rid of fruit categories that we have no hope of winning or
   have already won. we have won a category if we have more than half of the fruit
   in that category and we have no hope of winning if the enemy can make the same claim.
   */
  this.filter_out_won_or_lost_categories = function () {
    return this.fruit_stash.fruits.filter(function (fruit) {
      var win_count = this.win_counts[fruit];
      var my_count = get_my_item_count(fruit), enemy_count = get_opponent_item_count(fruit);
      var total_collected = my_count + enemy_count;
      var keep = !(enemy_count >= win_count || total_collected === (2 * win_count - 1));
      return keep;
    }, this);
  };
  /*
   update fruit locations, filter out won/lost categories, find the closest
   fruit and try to go to it.
   */
  this.make_move = function (board) {
    this.init_or_update_fruit_locations(board);
    this.fruit_stash.fruits = this.filter_out_won_or_lost_categories();
    var my_loc = [get_my_x(), get_my_y()];
    if (this.fruit_stash.fruits.length === 0) {
      return PASS;
    }
    var fruit_loc = this.find_closest_fruit(my_loc);
    var move_direction = this.calculate_move_direction(fruit_loc, my_loc);
    return move_direction === undefined ? TAKE : move_direction;
  };
}

var strategy;
/**
 * Called every time a new game starts. Currently it creates a new
 * strategy instance every time this function is called.
 */
function new_game() {
  strategy = create_strategy_instance(Still_Pretty_Greedy);
}

/**
 * The function required by the game API. It just delegates to
 * the make_move method of the strategy instance created by new_game.
 * @return {*}
 */
function make_move() {
  return strategy.make_move(get_board());
}