/* 
this should serve as a prototype for other strategy constructors. 
requires the constructor of the strategy that wants to use this as
a prototype to initialize fruit_locations and init. 
*/
var common_methods = {
   update_fruits: function(board) {
      var acc = [];
      for (var i = 0, l = this.fruit_locations.length; i < l; i++) {
         var location = this.fruit_locations[i];
         var item = board[location[0]][location[1]];
         if (item) {
            acc.push(location);
         }
      }
      this.fruit_locations = acc;
   },
   find_fruits: function(board) {
      for (var col_index = 0; col_index < WIDTH; col_index++) {
         var column = board[col_index];
         for (var row_index = 0; row_index < HEIGHT; row_index++) {
            if (column[row_index]) {
               this.fruit_locations.push([col_index, row_index]);
            }
         }
      }
   },
   init_or_update: function(board) {
      if (!this.init) {
         this.find_fruits(board);
         this.init = true;
      } else {
         this.update_fruits(board);
      }      
   }
};

function create_strategy_instance(constructor) {
   constructor.prototype = common_methods;
   var instance = new constructor();
   instance.init = false;
   instance.fruit_locations = [];
   return instance;
}

/* 
simple greedy strategy for getting to the closest fruit.
does not take the opponent's location into account when
making decisions. so if an enemy is closer to a fruit than us
then this will not affect our decision making and we will move
towards a location that will be empty before we get there.
*/
function Closest_Fruit_Strategy() {
   /* functionality specific to this strategy */
   this.find_closest_fruit_location = function(x, y) {
      var closest = null;
      var min_distance = Infinity;
      this.fruit_locations.forEach(function(location) {
         var distance = Math.abs(x - location[0]) + Math.abs(y - location[1]);
         if (distance <= min_distance) {
            closest = location;
            min_distance = distance;
         }
      });
      return closest;
   };
   this.calculate_move = function(closest_fruit_location, my_location) {
      // figure out if we need to move left or right
      var x_delta = closest_fruit_location[0] - my_location[0];
      if (x_delta > 0) {
         return EAST;
      } else if (x_delta < 0) {
         return WEST;
      }
      // figure out if we need to move left or right
      var y_delta = closest_fruit_location[1] - my_location[1];
      if (y_delta > 0) {
         return SOUTH;
      } else if (y_delta < 0) {
         return NORTH;
      }
   };
   this.make_move = function(board) {
      var my_x = get_my_x(), my_y = get_my_y();
      if (board[my_x][my_y] > 0) {
          return TAKE;
      }
      this.init_or_update(board);
      var closest_fruit_location = this.find_closest_fruit_location(my_x, my_y);
      if (closest_fruit_location == null) {
         return PASS;
      }
      return this.calculate_move(closest_fruit_location, [my_x, my_y]);
   };
}

var strategy;
function new_game() {
   strategy = create_strategy_instance(Closest_Fruit_Strategy);
}

function make_move() {
   return strategy.make_move(get_board());
}
