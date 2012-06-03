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
    if (orientation === 0) { /* degenerate case of horizontal or vertical line or a single point*/
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
  },
  /**
   * Given coordinates of a bounding box and some nodes we figure
   * out which ones fit in that box and return them.
   * @param box_coords An object with "left", "right" properties that
   * contains the coordinates of the top left and bottom right end points
   * of the bounding box.
   * @param nodes The set of initial nodes we want to filter down to ones
   * that are contained in the bounding box.
   * @returns {Array} The list of nodes contained in the bounding box
   */
  nodes_in_box : function(box_coords, nodes, extra_filter) {
    /* extra_filter defaults to returning true if no filtering function is passed in */
    extra_filter = typeof extra_filter === 'undefined' ? function (node) { return true; } : extra_filter;
    var left_col_limit = box_coords.left[0], right_col_limit = box_coords.right[0];
    var top_row_limit = box_coords.left[1], bottom_row_limit = box_coords.right[1];
    return nodes.filter(function (node) {
      /* check column limits */
      if (node[0] >= left_col_limit && node[0] <= right_col_limit) {
        /* check row limits */
        if (node[1] >= top_row_limit && node[1] <= bottom_row_limit) {
          return extra_filter(node);
        }
      }
      return false;
    });
  }
};

/**
 * Serves as the namespace for functions that do something with paths
 * from one endpoint to another.
 * @type {Object}
 */
var path_construction = {
  /**
   * Merges two objects by destructively updating the first one
   * with keys and values from the second one.
   * @param a The first object that will be updated.
   * @param b The object that will be merged into the first one.
   */
  merge : function (a, b) {
    for (var k in b) {
      a[k] = b[k];
    }
  },
  /**
   * Takes an already constructed partial path and a reachability graph
   * and tries to extend the path forward. If extension is not possible
   * the original path is returned wrapped in an array.
   * @param partial_path The path we want to extend.
   * @param path_graph The reachability graph that serves as a constraint
   * on how a partial path can be extended.
   * @return {*}
   */
  extend_partial_path : function (partial_path, path_graph) {
    var possible_extensions = path_graph[partial_path[partial_path.length - 1]];
    if (!possible_extensions) {
      return [partial_path];
    }
    return possible_extensions.map(function (node) {
      return partial_path.concat([node]);
    });
  },
  /**
   * Given a set of partial paths and a reachability graph that serves as a constraint
   * for path extension we return the set of all possible extensions of the initial
   * set of partial paths.
   * @param partial_paths The partial paths that serve as seeds for extension.
   * @param path_graph The reachability graph that serves as a set of constraints
   * for path extension.
   * @return {Array}
   */
  extract_paths : function (partial_paths, path_graph) {
    var need_extension = [], done = [];
    /* see if we were able to extend anything and buffer those for potential re-extension.
    save everything else as done. */
    partial_paths.forEach(function (partial_path) {
      var extensions = this.extend_partial_path(partial_path, path_graph);
      if (extensions[0].length === partial_path.length) {
        done.push(partial_path);
      } else {
        extensions.forEach(function (extension) {
          need_extension.push(extension);
        });
      }
    }, this);
    /* base case */
    if (need_extension.length === 0) {
      return done;
    }
    /* recursive case */
    return done.concat(this.extract_paths(need_extension, path_graph));
  },
  /**
   * Given a start and end points along with nodes we want to pass through
   * we construct the paths that only pass through those nodes and no more.
   * @param start The initial point for the set of paths we want to construct.
   * @param end The terminal point for the set of paths.
   * @param nodes The set of points we want our paths to go through. The assumption
   * is that these nodes are contained in the box defined by the start and end points.
   * This array should contain all accessible nodes except the starting point. Accessible
   * means that the end point should be included in this array.
   * @returns {Array} The set of paths given as a set of ordered points.
   */
  construct_restricted_paths : function(start, end, nodes) {
    /* if nodes does not include the end point then we need to add it */
    if (!nodes.some(function (node) { return node[0] === end[0] && node[1] === end[1]; })) {
      nodes.push(end);
    }
    /* construct a partial reachability graph and refine it until we have the reachability graph */
    var initial_graph = {}; initial_graph[start] = nodes;
    var refined_data = this.single_refinement_step(end, nodes);
    var refined_graph = refined_data.graph;
    var need_further_refinement = Object.keys(refined_graph);
    /* base case */
    if (need_further_refinement.length === 0) {
      return initial_graph;
    }
    /* recursive case */
    initial_graph[start] = refined_data.filtered_nodes;
    need_further_refinement.map(function (node) {
      return this.construct_restricted_paths(node, end, refined_graph[node]);
    }, this).forEach(function (graph) { this.merge(initial_graph, graph); }, this);
    return initial_graph;
  },
  /**
   * Given a starting node and an ending node and a set of nodes that paths need to pass
   * through this function returns the set of all possible paths that satisfy those
   * constraints.
   * @param start Our starting point.
   * @param end Our destination.
   * @param nodes The set of nodes we want to pass through if possible.
   * @return {Array}
   */
  possible_paths : function (start, end, nodes) {
    /* extract the reachability graph */
    var reachability_graph = this.construct_restricted_paths(start, end, nodes);
    return this.extract_paths([[start]], reachability_graph);
  },
  /**
   * Given a partially constructed set of data that serves as a proxy for
   * a reachability graph we perform a single refinement step to increase
   * the granularity of the reachability graph by splitting the set of
   * reachable nodes into two sets if possible.
   * @param end Our destination node.
   * @param reachable_nodes A set of partially constructed reachable nodes.
   * @return {*}
   */
  single_refinement_step : function(end, reachable_nodes) {
    var cache_hit;
    //noinspection AssignmentResultUsedJS
    if (cache_hit = this.single_refinement_step_cache[[end, reachable_nodes]]) {
      return cache_hit;
    }
    var refinement = this.refine(end, reachable_nodes);
    var reachable_in_two_steps = refinement.reachable_in_two_steps;
    var filtered_nodes = reachable_nodes.filter(function (node) { return !reachable_in_two_steps[node]; });
    var refined_data = {filtered_nodes : filtered_nodes, graph : refinement.refined_graph};
    return this.single_refinement_step_cache[[end, reachable_nodes]] = refined_data;
  },
  /**
   * Keeps refining the set of nodes until everything is reachable in one step.
   * @param end Where we want to end up.
   * @param nodes The initial set of nodes we want to pass through.
   * @return {Object}
   */
  refine : function (end, nodes) {
    var reachable_nodes = {}, accumulator = {};
    nodes.forEach(function (node) {
      var box_coords = coordinate_functions.box_coordinates_from_endpoints(node, end);
      var filter = function (n) { return n[0] !== node[0] || n[1] !== node[1]; };
      var refined_nodes = coordinate_functions.nodes_in_box(box_coords, nodes, filter);
      if (refined_nodes.length > 0) {
        refined_nodes.forEach(function (node) { reachable_nodes[node] = true; });
        accumulator[node] = refined_nodes;
      }
    });
    return {reachable_in_two_steps : reachable_nodes, refined_graph : accumulator};
  },
  /**
   * Caches computations of refinement.
   */
  single_refinement_step_cache : {}
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
    this.sort_fruits();
  },
  /**
   * Go through the board and save all the fruit locations.
   * Also, while making a pass through the board we keep
   * track of how many fruits of that type we would need to
   * get in order to win that category. Also, compute the transpose
   * mapping so that we know what fruit each node maps to.
   * @param board Column major grid that contains cells with fruits.
   */
  find_fruits_and_compute_win_counts : function (board) {
    board.forEach(function (column, col_index) {
      column.forEach(function (fruit_type, row_index) {
        var fruit_location = [col_index, row_index], fruit_locations;
        if (fruit_type > 0) {
          fruit_locations = this.fruit_stash[fruit_type];
          this.node_to_fruit_mapping[fruit_location] = fruit_type;
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
    /* sort the fruits according to rarity */
    this.sort_fruits();
  },
  /**
   * Sorts the available fruits according to rarity.
   */
  sort_fruits : function() {
    var win_counts = this.win_counts;
    this.fruit_stash.fruits.sort(function (a,b) { return win_counts[a] - win_counts[b]; });
  },
  /**
   * The game has a predefined set of constants for directional movement.
   * So given where we want to move and some other location this function
   * returns one of the direction specifiers that will get us closer to
   * the desired location.
   * @param move_location Where we want to move.
   * @param my_location Where we want to move from.
   * @return {*}
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
  /**
   * Convenience function for updating fruit locations. This
   * should be called on every turn of the game to update the
   * locations of the fruits.
   * @param board Column major grid that contains cells with fruit types.
   */
  init_or_update_fruit_locations : function (board) {
    if (!this.init) {
      this.find_fruits_and_compute_win_counts(board);
      this.init = true;
    } else {
      this.update_fruits(board);
    }
  },
  /**
   * Finds the closest fruit to a given location. Will throw
   * an exception or return null if fruit_stash and fruit_stash.fruits
   * don't contain anything. So this function will only return sensible
   * results if our fruit_stash is sane.
   * @param loc The location that is going to serve as the center of our search
   * for the closest fruit.
   * @return {*} The location of the closest fruit. Note that this is not unique.
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
  instance.node_to_fruit_mapping = {};
  /* return the new instance. */
  return instance;
}

function Planner(path) {
  this.path = path;
  this.next_move = function (board, current_x, current_y) {
    if (this.path[0][0] === current_x && this.path[0][1] === current_y) {
      var pos = this.path.shift();
      if (board[pos[0]][pos[1]] > 0) {
        return TAKE;
      }
    }
    return common_strategy_methods.calculate_move_direction(this.path[0], [current_x, current_y]);
  };
}
function Rare_Fruit_First() {
  this.planner = new Planner([]);
  /* given a starting and ending point we use the methods in path_construction to
  construct a list of possible paths from start to end.
  */
  this.get_paths = function (start, end) {
    /* find all the fruits that are in the box defined by start and end */
    var box_coords = coordinate_functions.box_coordinates_from_endpoints(start, end);
    var fruit_stash = this.fruit_stash;
    var all_fruit_locations = fruit_stash.fruits.reduce(function (acc, fruit) {
      return acc.concat(fruit_stash[fruit]);
    }, []);
    var filter = function (loc) { return loc[0] !== start[0] || loc[1] !== start[1]; };
    var fruits_in_box = coordinate_functions.nodes_in_box(box_coords, all_fruit_locations, filter);
    /* construct path graph */
    return path_construction.possible_paths(start, end, fruits_in_box);
  };
  this.make_move = function (board) {
    /* update fruit list and fruit locations */
    this.init_or_update_fruit_locations(board);
    var my_position = [get_my_x(), get_my_y()];
    /* verify that our destination still contains fruit. if it doesn't
    we need to invalidate the planner.
     */
    if (this.planner.path.length > 0) {
      var destination = this.planner.path[this.planner.path.length - 1];
      if (board[destination[0]][destination[1]] > 0) {
        return this.planner.next_move(board, my_position[0], my_position[1]);
      }
    }
    /* otherwise our planner is out of sync so we need to replan */
    /* find a fruit with a low win count and chart a path to it */
    var win_counts = this.win_counts;
    var rare_fruit = this.fruit_stash.fruits.reduce(function (low_win_fruit, fruit) {
      return win_counts[low_win_fruit] <= win_counts[fruit] ? low_win_fruit : fruit;
    });
    /* get our current position and for the rare fruit we just found find the location closest to us */
    var rare_fruit_closest_loc = this.fruit_stash[rare_fruit].reduce(function (closest, loc) {
      var closest_distance = coordinate_functions.manhattan_metric(my_position, closest);
      var new_distance = coordinate_functions.manhattan_metric(my_position, loc);
      return new_distance <= closest_distance ? loc : closest;
    });
    /* find all restricted paths to that location */
    var paths = this.get_paths(my_position, rare_fruit_closest_loc);
    /* pick the best path out of those */
    var best_path = this.pick_best_path(paths);
    this.planner.path = best_path;
    return this.planner.next_move(board, my_position[0], my_position[1]);
  };
  this.pick_best_path = function (paths) {
    var fruits = this.fruit_stash.fruits;
    /* turn each path into a hash map where we have fruit -> fruit count */
    paths.map(function (path) {
      /* initialize the fruit count for this path */
      var fruit_count = {};
      this.fruit_stash.fruits.forEach(function (fruit) { fruit_count[fruit] = 0; });
      /* count the fruits on the path */
      path.forEach(function (node) {
        fruit_count[this.node_to_fruit_mapping[node]] += 1;
      }, this);
      return [path, fruit_count];
    }, this).sort(function (p1, p2) {
        var scores = fruits.map(function (fruit) { return p2[1][fruit] - p1[1][fruit]; });
        if (scores.some(function (order) { return order <= 0; })) {
          return -1;
        }
        return 1;
    });
    return paths[0];
  };
}

var strategy;
/**
 * Called every time a new game starts. Currently it creates a new
 * strategy instance every time this function is called.
 */
function new_game() {
  /* initialize new strategy instance */
  strategy = create_strategy_instance(Rare_Fruit_First);
  /* reset refinement cache */
  path_construction.single_refinement_step_cache = {};
}

/**
 * The function required by the game API. It just delegates to
 * the make_move method of the strategy instance created by new_game.
 * @return {*}
 */
function make_move() {
  return strategy.make_move(get_board());
}