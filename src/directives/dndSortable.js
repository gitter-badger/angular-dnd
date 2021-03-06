module.directive('dndSortableList', ['$parse', '$compile', function($parse, $compile) {
    function link(scope, element, attrs, ctrl) {
        var defaults = {
            layer: 'common'
        };
        var opts = ctrl.options = extend({}, defaults, $parse(attrs.dndSortableOpts)(scope) || {});
        var getter = ctrl.getter = $parse(attrs.dndSortableList) || angular.noop;
        var bindings = {};

        bindings[opts.layer+'.dragover'] = function(api) {
            if(getter(scope).length > 0) {
                return;
            }

            api.$sortable.model = {list: getter(scope)};
            api.$sortable.insertBefore = true;
            element.append(api.placeholder[0]);
        };

        element.dndBind(bindings);
    }

    controller.$inject = ['$scope', '$element', '$attrs'];
    function controller (scope, element, attrs) { }

    return {
        scope: true,
        link: link,
        controller: controller
    };
}]);

module.directive('dndSortable', ['$parse', '$compile', function($parse, $compile) {
    var placeholder, ngRepeatRegExp = /^\s*([\s\S]+?)\s+in\s+([\s\S]+?)(?:\s+track\s+by\s+([\s\S]+?))?\s*$/;
    var defaults = {
        layer: 'common'
    };


    function join(obj, sep1, sep2) {
        return Object.getOwnPropertyNames(obj).map(function(key) {
            return [key, obj[key]].join(sep1);
        }).join(sep2);
    }

    function joinObj (obj) {
        return '{' + join(obj, ':', ',') + '}';
    }

    function joinAttrs (attrs) {
        return join(attrs, '="', '" ') + '"';
    }

    function template(element, tAttrs) {
        var tag = element[0].nodeName.toLowerCase();
        var ngRepeat = tAttrs.ngRepeat || '';
        var match = ngRepeat.match(ngRepeatRegExp);

        if(!match) {
            throw 'dnd-sortable-item requires ng-repeat as dependence';
        }

        var opts = angular.extend({
            layer: "common",
        }, $parse(tAttrs.dndSortableOpts)());

        console.log(opts);

        var attrs = {
            'ng-transclude': '',
            'dnd-draggable': '',
            'dnd-draggable-opts': joinObj({
                helper: "'clone'",
                useAsPoint: true,
                layer: opts.layer
            }),
            'dnd-droppable': '',
            'dnd-droppable-opts': joinObj({
                layer: opts.layer,
            }),
            'dnd-on-dragstart': '$$onDragStart($api, $dropmodel, $dragmodel)',
            'dnd-on-dragend': '$$onDragEnd($api, $dropmodel, $dragmodel)',
            'dnd-on-dragover': '$$onDragOver($api, $dropmodel, $dragmodel)',
            'dnd-on-drag': '$$onDrag($api, $dropmodel, $dragmodel)',
            'dnd-model': '{item: ' + match[1] + ', list: ' + match[2] + ', index: $index}',
        };

        return '<' + tag + ' ' + joinAttrs(attrs) + '></' + tag + '>';
    }

    function link(scope, element, attrs, ctrls) {
        var listCtrl = ctrls[0];
        var css = element.dndCss(['float', 'display']);
        var parentNode = element[0].parentNode;
        var floating = /left|right|inline/.test(css.float + css.display);
        var getter = $parse(attrs.dndModel) || noop;
        var sortstartCallback = $parse(attrs.dndOnSortstart);
        var sortCallback = $parse(attrs.dndOnSort);
        var sortchangeCallback = $parse(attrs.dndOnSortchange);
        var sortendCallback = $parse(attrs.dndOnSortend);
        var sortenterCallback = $parse(attrs.dndOnSortenter);
        var sortleaveCallback = $parse(attrs.dndOnSortleave);


        function isHalfway(dragTarget, axis, dropmodel) {
            var rect = element.dndClientRect();

            return (floating ? (axis.x - rect.left) / rect.width : (axis.y - rect.top) / rect.height) > 0.5;
        }

        function moveValue(fromIndex, fromList, toIndex, toList) {
            toList = toList || fromList;
            toList.splice(toIndex, 0, fromList.splice(fromIndex, 1)[0]);
        }

        scope.$$onDragStart = function(api) {
            sortstartCallback(scope);

            api.placeholder = element.clone();
            element.addClass('ng-hide');
            api.placeholder.addClass('angular-dnd-placeholder');
            parentNode.insertBefore(api.placeholder[0], element[0]);
            api.$sortable = {};
            api.clearCache();

            scope.$apply();
        };

        scope.$$onDragOver = function(api, dropmodel, dragmodel) {
            var halfway = isHalfway(api.getDragTarget(), api.getBorderedAxis());

            halfway ? parentNode.insertBefore(api.placeholder[0], element[0].nextSibling) : parentNode.insertBefore(api.placeholder[0], element[0]);

            var model = getter(scope);

            if (sortchangeCallback !== angular.noop && (!api.$sortable.model || api.$sortable.model.index !== model.index)) {
                sortchangeCallback(scope);
                scope.$apply();
            }

            api.$sortable.model = model;
            api.$sortable.insertBefore = !halfway;

            api.clearCache();
        };

        scope.$$onDragEnd = function(api) {
            element.removeClass('ng-hide');
            api.placeholder.remove();

            if(!api.$sortable.model) {
                return;
            }

            var fromIndex = scope.$index,
                toIndex = api.$sortable.model.index,
                fromList = getter(scope).list,
                toList = api.$sortable.model.list;

            if(toList === fromList) {
                if(toIndex < fromIndex) {
                    if(!api.$sortable.insertBefore) toIndex++;
                } else {
                    if(api.$sortable.insertBefore) toIndex--;
                }
            } else if(!api.$sortable.insertBefore) toIndex++;

            moveValue(fromIndex, fromList, toIndex, toList);

            api.clearCache();

            sortendCallback(scope);
            scope.$apply();
        };

        (sortCallback !== angular.noop) && (scope.$$onDrag = function(api) {
            sortCallback(scope);
            scope.$apply();
        });
    }

    return {
        scope: true,
        transclude: true,
        template: template,
        replace: true,
        link: link,
        require: ['^dndSortableList']
    };
}]);
//TODO:
//create - вызывается при создании списка

//activate - начат процесс сортировки (вызывается у всех связанных списков)
//start - начат процесс сортировки (вызывается только у списка инициатора)

//sort - вызывается при любом движении манипулятора при сортировке
//change - сортировка списка изменилась
//out - манипулятор с элементом вынесен за пределы списка (а также, если было событие over и небыло out то и  при окончании сортировки)
//over -  манипулятор с элементом внесен в пределы списка

//beforeStop - будет вызвано у списка инициатора
//update - будет вызвано если список изменился
//deactivate - вызывается у всех связанных списков
//stop - вызывается самым последним у списка инициатора

//receive - элемент дропнулся ИЗ другого списка
//remove - элмент дропнулся В другой список

//example: http://jsfiddle.net/UAcC7/1441/
